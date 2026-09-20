'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUserWithPermissions } from '@/lib/auth-server';
import { z } from 'zod';

// ============================================================================
// Validation Schemas
// ============================================================================

const AssignShiftSchema = z.object({
  employee_id: z.string().uuid(),
  shift_type_id: z.string().uuid(),
  assigned_date: z.string().date(),
  notes: z.string().max(500).optional(),
});

const ConfirmShiftAssignmentSchema = z.object({
  assignment_id: z.string().uuid(),
  confirmed: z.boolean(),
});

const CancelShiftAssignmentSchema = z.object({
  assignment_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

const RequestShiftSwapSchema = z.object({
  assignment_id: z.string().uuid(),
  requested_employee_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

const RespondShiftSwapSchema = z.object({
  swap_id: z.string().uuid(),
  accepted: z.boolean(),
  response_reason: z.string().max(500).optional(),
});

// ============================================================================
// Assign Shift
// ============================================================================

export async function assignShiftAction(data: unknown) {
  try {
    const validated = AssignShiftSchema.parse(data);
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    if (!profile.permissions?.includes('settings.write')) {
      return { error: 'Permission denied: settings.write', code: 'FORBIDDEN' };
    }

    const client = createClient();

    // Check employee exists
    const { data: employee, error: empError } = await client
      .from('employee_details')
      .select('id, company_id')
      .eq('id', validated.employee_id)
      .eq('company_id', profile.company_id)
      .single();

    if (empError || !employee) {
      return { error: 'Employee not found', code: 'NOT_FOUND' };
    }

    // Check shift type exists
    const { data: shiftType } = await client
      .from('shift_types')
      .select('id, max_employees_per_shift')
      .eq('id', validated.shift_type_id)
      .eq('company_id', profile.company_id)
      .single();

    if (!shiftType) {
      return { error: 'Shift type not found', code: 'NOT_FOUND' };
    }

    // Check for conflicts
    const { data: conflictResult } = await client.rpc('check_shift_conflict', {
      p_employee_id: validated.employee_id,
      p_assigned_date: validated.assigned_date,
    });

    if (conflictResult?.[0]?.has_conflict) {
      return {
        error: 'Employee already has shift on this date',
        code: 'CONFLICT_EXISTS',
        conflicts: conflictResult[0].conflict_details,
      };
    }

    // Check max employees for shift
    if (shiftType.max_employees_per_shift) {
      const { data: countData } = await client
        .from('shift_assignments')
        .select('id')
        .eq('shift_type_id', validated.shift_type_id)
        .eq('assigned_date', validated.assigned_date)
        .eq('status', 'confirmed');

      if (countData && countData.length >= shiftType.max_employees_per_shift) {
        return {
          error: `Maximum ${shiftType.max_employees_per_shift} employees already assigned to this shift`,
          code: 'CAPACITY_EXCEEDED',
        };
      }
    }

    // Create assignment
    const { data: assignment, error: createError } = await client
      .from('shift_assignments')
      .insert({
        company_id: profile.company_id,
        employee_id: validated.employee_id,
        shift_type_id: validated.shift_type_id,
        assigned_date: validated.assigned_date,
        status: 'planned',
        assigned_by: user.id,
        notes: validated.notes || null,
      })
      .select()
      .single();

    if (createError) {
      console.error('Shift assignment creation error:', createError);
      return { error: 'Failed to create shift assignment', code: 'CREATE_FAILED' };
    }

    // Audit log
    await client.from('audit_logs').insert({
      company_id: profile.company_id,
      actor_user_id: user.id,
      action: 'shift_assigned',
      entity_type: 'shift_assignment',
      entity_id: assignment.id,
      new_state: {
        employee_id: validated.employee_id,
        assigned_date: validated.assigned_date,
        status: 'planned',
      },
    });

    revalidatePath('/shifts');
    return { data: assignment };
  } catch (error) {
    console.error('Assign shift error:', error);
    return {
      error: error instanceof z.ZodError ? error.errors[0].message : 'Unknown error',
      code: 'VALIDATION_ERROR',
    };
  }
}

// ============================================================================
// Confirm Shift Assignment
// ============================================================================

export async function confirmShiftAssignmentAction(data: unknown) {
  try {
    const validated = ConfirmShiftAssignmentSchema.parse(data);
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    if (!profile.permissions?.includes('settings.write')) {
      return { error: 'Permission denied: settings.write', code: 'FORBIDDEN' };
    }

    const client = createClient();

    // Get assignment
    const { data: assignment, error: getError } = await client
      .from('shift_assignments')
      .select('*')
      .eq('id', validated.assignment_id)
      .eq('company_id', profile.company_id)
      .single();

    if (getError || !assignment) {
      return { error: 'Shift assignment not found', code: 'NOT_FOUND' };
    }

    const newStatus = validated.confirmed ? 'confirmed' : 'cancelled';

    const { data: updated, error: updateError } = await client
      .from('shift_assignments')
      .update({
        status: newStatus,
        confirmed_by: user.id,
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', validated.assignment_id)
      .select()
      .single();

    if (updateError) {
      console.error('Shift update error:', updateError);
      return { error: 'Failed to update shift assignment', code: 'UPDATE_FAILED' };
    }

    // Audit log
    await client.from('audit_logs').insert({
      company_id: profile.company_id,
      actor_user_id: user.id,
      action: validated.confirmed ? 'shift_confirmed' : 'shift_cancelled',
      entity_type: 'shift_assignment',
      entity_id: validated.assignment_id,
      new_state: { status: newStatus },
    });

    revalidatePath('/shifts');
    return { data: updated };
  } catch (error) {
    console.error('Confirm shift error:', error);
    return {
      error: error instanceof z.ZodError ? error.errors[0].message : 'Unknown error',
      code: 'VALIDATION_ERROR',
    };
  }
}

// ============================================================================
// Request Shift Swap
// ============================================================================

export async function requestShiftSwapAction(data: unknown) {
  try {
    const validated = RequestShiftSwapSchema.parse(data);
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const client = createClient();

    // Get assignment
    const { data: assignment, error: getError } = await client
      .from('shift_assignments')
      .select('*')
      .eq('id', validated.assignment_id)
      .eq('company_id', profile.company_id)
      .single();

    if (getError || !assignment) {
      return { error: 'Shift assignment not found', code: 'NOT_FOUND' };
    }

    // Check requested employee exists
    const { data: requestedEmp } = await client
      .from('employee_details')
      .select('id')
      .eq('id', validated.requested_employee_id)
      .eq('company_id', profile.company_id)
      .single();

    if (!requestedEmp) {
      return { error: 'Requested employee not found', code: 'NOT_FOUND' };
    }

    // Create swap request
    const { data: swap, error: createError } = await client
      .from('shift_swaps')
      .insert({
        company_id: profile.company_id,
        original_assignment_id: validated.assignment_id,
        requested_employee_id: validated.requested_employee_id,
        reason: validated.reason || null,
        status: 'requested',
      })
      .select()
      .single();

    if (createError) {
      console.error('Shift swap creation error:', createError);
      return { error: 'Failed to create swap request', code: 'CREATE_FAILED' };
    }

    // Audit log
    await client.from('audit_logs').insert({
      company_id: profile.company_id,
      actor_user_id: user.id,
      action: 'shift_swap_requested',
      entity_type: 'shift_swap',
      entity_id: swap.id,
      new_state: {
        assignment_id: validated.assignment_id,
        requested_employee_id: validated.requested_employee_id,
      },
    });

    revalidatePath('/shifts');
    return { data: swap };
  } catch (error) {
    console.error('Request shift swap error:', error);
    return {
      error: error instanceof z.ZodError ? error.errors[0].message : 'Unknown error',
      code: 'VALIDATION_ERROR',
    };
  }
}

// ============================================================================
// Respond to Shift Swap
// ============================================================================

export async function respondShiftSwapAction(data: unknown) {
  try {
    const validated = RespondShiftSwapSchema.parse(data);
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const client = createClient();

    // Get swap request
    const { data: swap, error: getError } = await client
      .from('shift_swaps')
      .select('*')
      .eq('id', validated.swap_id)
      .eq('company_id', profile.company_id)
      .single();

    if (getError || !swap) {
      return { error: 'Shift swap not found', code: 'NOT_FOUND' };
    }

    const newStatus = validated.accepted ? 'accepted' : 'rejected';

    const { data: updated, error: updateError } = await client
      .from('shift_swaps')
      .update({
        status: newStatus,
        responded_by: user.id,
        responded_at: new Date().toISOString(),
      })
      .eq('id', validated.swap_id)
      .select()
      .single();

    if (updateError) {
      console.error('Shift swap update error:', updateError);
      return { error: 'Failed to update swap request', code: 'UPDATE_FAILED' };
    }

    // If accepted, swap the assignments
    if (validated.accepted) {
      // TODO: Implement actual swap logic
      // - Get both assignments
      // - Swap employee_id values
      // - Update both assignments
    }

    // Audit log
    await client.from('audit_logs').insert({
      company_id: profile.company_id,
      actor_user_id: user.id,
      action: validated.accepted ? 'shift_swap_accepted' : 'shift_swap_rejected',
      entity_type: 'shift_swap',
      entity_id: validated.swap_id,
      new_state: { status: newStatus },
    });

    revalidatePath('/shifts');
    return { data: updated };
  } catch (error) {
    console.error('Respond shift swap error:', error);
    return {
      error: error instanceof z.ZodError ? error.errors[0].message : 'Unknown error',
      code: 'VALIDATION_ERROR',
    };
  }
}

// ============================================================================
// Get Shifts for Employee (Date Range)
// ============================================================================

export async function getEmployeeShiftsAction(
  employeeId: string,
  startDate: string,
  endDate: string,
) {
  try {
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const client = createClient();

    const { data: shifts, error } = await client.rpc('get_employee_shifts', {
      p_employee_id: employeeId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) {
      console.error('Get shifts error:', error);
      return { error: 'Failed to get shifts', code: 'QUERY_FAILED' };
    }

    return { data: shifts || [] };
  } catch (error) {
    console.error('Get employee shifts error:', error);
    return { error: 'Unknown error', code: 'UNKNOWN' };
  }
}

// ============================================================================
// Get Shift Calendar (by Date)
// ============================================================================

export async function getShiftCalendarAction(date: string) {
  try {
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const client = createClient();

    const { data: assignments, error } = await client.rpc(
      'get_shift_assignments_by_date',
      {
        p_company_id: profile.company_id,
        p_date: date,
      }
    );

    if (error) {
      console.error('Get calendar error:', error);
      return { error: 'Failed to get shift calendar', code: 'QUERY_FAILED' };
    }

    return { data: assignments || [] };
  } catch (error) {
    console.error('Get shift calendar error:', error);
    return { error: 'Unknown error', code: 'UNKNOWN' };
  }
}

import { revalidatePath } from 'next/cache';
