'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUserWithPermissions } from '@/lib/auth-server';
import { z } from 'zod';

// ============================================================================
// Validation Schemas
// ============================================================================

const CreateTimeEntrySchema = z.object({
  employee_id: z.string().uuid(),
  date: z.string().date(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime().optional(),
  break_duration_minutes: z.number().int().min(0).max(480).optional(),
  notes: z.string().max(500).optional(),
  source: z.enum(['mobile', 'web', 'qr', 'nfc', 'admin']).default('web'),
});

const UpdateTimeEntrySchema = z.object({
  time_entry_id: z.string().uuid(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  break_duration_minutes: z.number().int().min(0).max(480).optional(),
  notes: z.string().max(500).optional(),
});

const CompleteTimeEntrySchema = z.object({
  time_entry_id: z.string().uuid(),
  end_time: z.string().datetime(),
  break_duration_minutes: z.number().int().min(0).max(480).default(0),
});

const CorrectTimeEntrySchema = z.object({
  time_entry_id: z.string().uuid(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  break_duration_minutes: z.number().int().min(0).max(480).optional(),
  reason: z.string().min(10).max(500),
});

const GetTimeEntrySchema = z.object({
  time_entry_id: z.string().uuid(),
});

const GetDailyTimeSchema = z.object({
  employee_id: z.string().uuid(),
  date: z.string().date(),
});

const GetWeeklyTimeSchema = z.object({
  employee_id: z.string().uuid(),
  week_start: z.string().date(),
});

// ============================================================================
// Create Time Entry
// ============================================================================

export async function createTimeEntryAction(data: unknown) {
  try {
    const validated = CreateTimeEntrySchema.parse(data);
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    // Permission check
    if (!profile.permissions?.includes('time.create')) {
      return { error: 'Permission denied: time.create', code: 'FORBIDDEN' };
    }

    // Validate end_time is after start_time
    if (validated.end_time) {
      const start = new Date(validated.start_time);
      const end = new Date(validated.end_time);
      if (end <= start) {
        return { error: 'End time must be after start time', code: 'INVALID_TIME_RANGE' };
      }
    }

    const client = createClient();

    // Check employee exists and belongs to company
    const { data: employee, error: empError } = await client
      .from('employee_details')
      .select('id, company_id')
      .eq('id', validated.employee_id)
      .eq('company_id', profile.company_id)
      .single();

    if (empError || !employee) {
      return { error: 'Employee not found', code: 'NOT_FOUND' };
    }

    // Calculate duration if end_time provided
    let duration_minutes: number | null = null;
    let net_working_minutes: number | null = null;

    if (validated.end_time) {
      const start = new Date(validated.start_time);
      const end = new Date(validated.end_time);
      duration_minutes = Math.round((end.getTime() - start.getTime()) / 60000);

      if (duration_minutes < 0) {
        return { error: 'Duration cannot be negative', code: 'INVALID_DURATION' };
      }

      net_working_minutes =
        duration_minutes - (validated.break_duration_minutes || 0);
    }

    // Get expected duration from work time model
    const { data: workDayConfig } = await client.rpc('get_work_day_config', {
      p_work_time_model_id: null, // Will be filled from employee's current model
      p_date: validated.date,
    });

    // Create time entry
    const { data: timeEntry, error: createError } = await client
      .from('time_entries')
      .insert({
        company_id: profile.company_id,
        employee_id: validated.employee_id,
        date: validated.date,
        start_time: validated.start_time,
        end_time: validated.end_time || null,
        duration_minutes,
        break_duration_minutes: validated.break_duration_minutes || 0,
        net_working_minutes,
        status: validated.end_time ? 'completed' : 'in_progress',
        source: validated.source,
        notes: validated.notes || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (createError) {
      console.error('Time entry creation error:', createError);
      return { error: 'Failed to create time entry', code: 'CREATE_FAILED' };
    }

    // Audit log
    await client.from('audit_logs').insert({
      company_id: profile.company_id,
      actor_user_id: user.id,
      action: 'time_entry_created',
      entity_type: 'time_entry',
      entity_id: timeEntry.id,
      new_state: {
        employee_id: validated.employee_id,
        date: validated.date,
        start_time: validated.start_time,
        source: validated.source,
      },
    });

    revalidatePath('/admin/time');
    return { data: timeEntry };
  } catch (error) {
    console.error('Create time entry error:', error);
    return {
      error: error instanceof z.ZodError ? error.errors[0].message : 'Unknown error',
      code: 'VALIDATION_ERROR',
    };
  }
}

// ============================================================================
// Complete Time Entry
// ============================================================================

export async function completeTimeEntryAction(data: unknown) {
  try {
    const validated = CompleteTimeEntrySchema.parse(data);
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    if (!profile.permissions?.includes('time.update')) {
      return { error: 'Permission denied: time.update', code: 'FORBIDDEN' };
    }

    const client = createClient();

    // Get current entry
    const { data: entry, error: getError } = await client
      .from('time_entries')
      .select('*')
      .eq('id', validated.time_entry_id)
      .eq('company_id', profile.company_id)
      .single();

    if (getError || !entry) {
      return { error: 'Time entry not found', code: 'NOT_FOUND' };
    }

    if (entry.status === 'approved') {
      return { error: 'Cannot update approved time entry', code: 'FORBIDDEN' };
    }

    // Calculate duration
    const start = new Date(entry.start_time);
    const end = new Date(validated.end_time);
    const duration_minutes = Math.round((end.getTime() - start.getTime()) / 60000);

    if (duration_minutes < 0) {
      return { error: 'End time must be after start time', code: 'INVALID_TIME_RANGE' };
    }

    const net_working_minutes = duration_minutes - (validated.break_duration_minutes || 0);

    // Update entry
    const { data: updated, error: updateError } = await client
      .from('time_entries')
      .update({
        end_time: validated.end_time,
        duration_minutes,
        break_duration_minutes: validated.break_duration_minutes,
        net_working_minutes,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', validated.time_entry_id)
      .select()
      .single();

    if (updateError) {
      console.error('Time entry update error:', updateError);
      return { error: 'Failed to complete time entry', code: 'UPDATE_FAILED' };
    }

    // Audit log
    await client.from('audit_logs').insert({
      company_id: profile.company_id,
      actor_user_id: user.id,
      action: 'time_entry_completed',
      entity_type: 'time_entry',
      entity_id: validated.time_entry_id,
      previous_state: {
        end_time: entry.end_time,
        status: entry.status,
      },
      new_state: {
        end_time: validated.end_time,
        status: 'completed',
      },
    });

    revalidatePath('/time');
    return { data: updated };
  } catch (error) {
    console.error('Complete time entry error:', error);
    return {
      error: error instanceof z.ZodError ? error.errors[0].message : 'Unknown error',
      code: 'VALIDATION_ERROR',
    };
  }
}

// ============================================================================
// Correct Time Entry
// ============================================================================

export async function correctTimeEntryAction(data: unknown) {
  try {
    const validated = CorrectTimeEntrySchema.parse(data);
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    if (!profile.permissions?.includes('time.update')) {
      return { error: 'Permission denied: time.update', code: 'FORBIDDEN' };
    }

    const client = createClient();

    // Get current entry
    const { data: entry, error: getError } = await client
      .from('time_entries')
      .select('*')
      .eq('id', validated.time_entry_id)
      .eq('company_id', profile.company_id)
      .single();

    if (getError || !entry) {
      return { error: 'Time entry not found', code: 'NOT_FOUND' };
    }

    const new_start_time = validated.start_time || entry.start_time;
    const new_end_time = validated.end_time || entry.end_time;
    const new_break = validated.break_duration_minutes ?? entry.break_duration_minutes;

    // Calculate new duration
    let new_duration = entry.duration_minutes;
    if (new_start_time && new_end_time) {
      const start = new Date(new_start_time);
      const end = new Date(new_end_time);
      new_duration = Math.round((end.getTime() - start.getTime()) / 60000);
    }

    const new_net_working = new_duration - new_break;

    // Create correction record (immutable)
    const { error: correctionError } = await client
      .from('time_entry_corrections')
      .insert({
        company_id: profile.company_id,
        time_entry_id: validated.time_entry_id,
        corrected_by: user.id,
        previous_start_time: entry.start_time,
        previous_end_time: entry.end_time,
        previous_duration_minutes: entry.duration_minutes,
        previous_break_duration_minutes: entry.break_duration_minutes,
        new_start_time,
        new_end_time,
        new_duration_minutes: new_duration,
        new_break_duration_minutes: new_break,
        reason: validated.reason,
      });

    if (correctionError) {
      console.error('Correction creation error:', correctionError);
      return { error: 'Failed to create correction', code: 'CREATE_FAILED' };
    }

    // Update time entry
    const { data: updated, error: updateError } = await client
      .from('time_entries')
      .update({
        start_time: new_start_time,
        end_time: new_end_time,
        duration_minutes: new_duration,
        break_duration_minutes: new_break,
        net_working_minutes: new_net_working,
        status: 'corrected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', validated.time_entry_id)
      .select()
      .single();

    if (updateError) {
      console.error('Time entry update error:', updateError);
      return { error: 'Failed to update time entry', code: 'UPDATE_FAILED' };
    }

    // Audit log
    await client.from('audit_logs').insert({
      company_id: profile.company_id,
      actor_user_id: user.id,
      action: 'time_entry_corrected',
      entity_type: 'time_entry',
      entity_id: validated.time_entry_id,
      previous_state: {
        start_time: entry.start_time,
        end_time: entry.end_time,
        break_duration_minutes: entry.break_duration_minutes,
      },
      new_state: {
        start_time: new_start_time,
        end_time: new_end_time,
        break_duration_minutes: new_break,
      },
      metadata: {
        reason: validated.reason,
      },
    });

    revalidatePath('/time');
    return { data: updated };
  } catch (error) {
    console.error('Correct time entry error:', error);
    return {
      error: error instanceof z.ZodError ? error.errors[0].message : 'Unknown error',
      code: 'VALIDATION_ERROR',
    };
  }
}

// ============================================================================
// Get Time Entry
// ============================================================================

export async function getTimeEntryAction(data: unknown) {
  try {
    const validated = GetTimeEntrySchema.parse(data);
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const client = createClient();

    const { data: timeEntry, error } = await client
      .from('time_entries')
      .select(
        `
        *,
        breaks:time_entry_breaks(*),
        corrections:time_entry_corrections(*)
      `,
      )
      .eq('id', validated.time_entry_id)
      .eq('company_id', profile.company_id)
      .single();

    if (error || !timeEntry) {
      return { error: 'Time entry not found', code: 'NOT_FOUND' };
    }

    return { data: timeEntry };
  } catch (error) {
    console.error('Get time entry error:', error);
    return {
      error: error instanceof z.ZodError ? error.errors[0].message : 'Unknown error',
      code: 'VALIDATION_ERROR',
    };
  }
}

// ============================================================================
// Get Daily Time Summary
// ============================================================================

export async function getDailyTimeSummaryAction(data: unknown) {
  try {
    const validated = GetDailyTimeSchema.parse(data);
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const client = createClient();

    const { data: summary, error } = await client.rpc('get_daily_time_summary', {
      p_employee_id: validated.employee_id,
      p_date: validated.date,
    });

    if (error) {
      console.error('Daily summary error:', error);
      return { error: 'Failed to get daily summary', code: 'QUERY_FAILED' };
    }

    return { data: summary[0] || null };
  } catch (error) {
    console.error('Get daily summary error:', error);
    return {
      error: error instanceof z.ZodError ? error.errors[0].message : 'Unknown error',
      code: 'VALIDATION_ERROR',
    };
  }
}

// ============================================================================
// Get Weekly Time Summary
// ============================================================================

export async function getWeeklyTimeSummaryAction(data: unknown) {
  try {
    const validated = GetWeeklyTimeSchema.parse(data);
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const client = createClient();

    const { data: summary, error } = await client.rpc('get_weekly_time_summary', {
      p_employee_id: validated.employee_id,
      p_start_date: validated.week_start,
    });

    if (error) {
      console.error('Weekly summary error:', error);
      return { error: 'Failed to get weekly summary', code: 'QUERY_FAILED' };
    }

    return { data: summary[0] || null };
  } catch (error) {
    console.error('Get weekly summary error:', error);
    return {
      error: error instanceof z.ZodError ? error.errors[0].message : 'Unknown error',
      code: 'VALIDATION_ERROR',
    };
  }
}

// ============================================================================
// Get Monthly Time Entries
// ============================================================================

export async function getMonthlyTimeEntriesAction(
  employeeId: string,
  year: number,
  month: number,
) {
  try {
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    if (!profile.permissions?.includes('time.read')) {
      return { error: 'Permission denied: time.read', code: 'FORBIDDEN' };
    }

    const client = createClient();

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data: entries, error } = await client
      .from('time_entries')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('company_id', profile.company_id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      console.error('Monthly entries error:', error);
      return { error: 'Failed to get time entries', code: 'QUERY_FAILED' };
    }

    return { data: entries || [] };
  } catch (error) {
    console.error('Get monthly time entries error:', error);
    return { error: 'Unknown error', code: 'UNKNOWN' };
  }
}

import { revalidatePath } from 'next/cache';
