'use server';

import { revalidatePath } from 'next/cache';
import { hasPermission } from '@/lib/auth-server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@novaro/shared-types';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

const createWorkTimeModelSchema = z.object({
  name: z.string().min(1, 'Name erforderlich'),
  model_type: z.enum(['full_time', 'part_time', 'flexible', 'shift']),
  description: z.string().optional(),
  weekly_hours: z.coerce.number().positive('Stunden müssen > 0 sein'),
  daily_hours: z.coerce.number().positive(),
  work_days_per_week: z.coerce.number().int().min(1).max(7),
  break_duration: z.coerce.number().int().min(0).max(480),
  rounding: z.coerce.number().int().min(1).max(60),
  allows_night_work: z.boolean().optional().default(false),
  allows_sunday_work: z.boolean().optional().default(false),
  core_hours_start: z.string().optional(),
  core_hours_end: z.string().optional(),
});

const updateWorkTimeModelSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  weekly_hours: z.coerce.number().positive().optional(),
  daily_hours: z.coerce.number().positive().optional(),
  work_days_per_week: z.coerce.number().int().min(1).max(7).optional(),
  break_duration: z.coerce.number().int().optional(),
  rounding: z.coerce.number().int().optional(),
  allows_night_work: z.boolean().optional(),
  allows_sunday_work: z.boolean().optional(),
});

type CreateWorkTimeModelInput = z.infer<typeof createWorkTimeModelSchema>;
type UpdateWorkTimeModelInput = z.infer<typeof updateWorkTimeModelSchema>;

/**
 * Create new work time model
 */
export async function createWorkTimeModelAction(
  input: CreateWorkTimeModelInput,
  adminUserId: string,
) {
  try {
    const canCreate = await hasPermission(adminUserId, 'settings.write');
    if (!canCreate) {
      return {
        success: false,
        error: 'Keine Berechtigung zum Erstellen von Arbeitszeitmodellen',
      };
    }

    const validated = createWorkTimeModelSchema.parse(input);

    // Get admin's company_id
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', adminUserId)
      .single();

    if (!adminProfile?.company_id) {
      return {
        success: false,
        error: 'Firmen-ID nicht gefunden',
      };
    }

    // Create work time model
    const { data: model, error: createError } = await supabase
      .from('work_time_models')
      .insert({
        company_id: adminProfile.company_id,
        name: validated.name,
        model_type: validated.model_type,
        description: validated.description || null,
        weekly_hours: validated.weekly_hours,
        daily_hours: validated.daily_hours,
        work_days_per_week: validated.work_days_per_week,
        break_duration: validated.break_duration,
        rounding: validated.rounding,
        allows_night_work: validated.allows_night_work,
        allows_sunday_work: validated.allows_sunday_work,
        core_hours_start: validated.core_hours_start || null,
        core_hours_end: validated.core_hours_end || null,
      })
      .select()
      .single();

    if (createError) {
      return {
        success: false,
        error: `Fehler: ${createError.message}`,
      };
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      company_id: adminProfile.company_id,
      actor_user_id: adminUserId,
      action: 'work_time_model_created',
      entity_type: 'work_time_model',
      entity_id: model.id,
      metadata: {
        name: validated.name,
        model_type: validated.model_type,
        weekly_hours: validated.weekly_hours,
      },
    });

    revalidatePath('/admin/work-time-models');

    return {
      success: true,
      modelId: model.id,
      message: `Arbeitszeitmodell "${validated.name}" erstellt`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}

/**
 * Update work time model
 */
export async function updateWorkTimeModelAction(
  input: UpdateWorkTimeModelInput,
  adminUserId: string,
) {
  try {
    const canUpdate = await hasPermission(adminUserId, 'settings.write');
    if (!canUpdate) {
      return {
        success: false,
        error: 'Keine Berechtigung zum Bearbeiten',
      };
    }

    const validated = updateWorkTimeModelSchema.parse(input);

    // Get current state
    const { data: current } = await supabase
      .from('work_time_models')
      .select('*')
      .eq('id', validated.id)
      .single();

    if (!current) {
      return {
        success: false,
        error: 'Modell nicht gefunden',
      };
    }

    // Prepare update data
    const updateData: any = {};
    if (validated.name) updateData.name = validated.name;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.weekly_hours) updateData.weekly_hours = validated.weekly_hours;
    if (validated.daily_hours) updateData.daily_hours = validated.daily_hours;
    if (validated.work_days_per_week) updateData.work_days_per_week = validated.work_days_per_week;
    if (validated.break_duration !== undefined) updateData.break_duration = validated.break_duration;
    if (validated.rounding) updateData.rounding = validated.rounding;
    if (validated.allows_night_work !== undefined) updateData.allows_night_work = validated.allows_night_work;
    if (validated.allows_sunday_work !== undefined) updateData.allows_sunday_work = validated.allows_sunday_work;
    updateData.updated_at = new Date().toISOString();

    // Update
    const { error: updateError } = await supabase
      .from('work_time_models')
      .update(updateData)
      .eq('id', validated.id);

    if (updateError) {
      return {
        success: false,
        error: `Update-Fehler: ${updateError.message}`,
      };
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      company_id: current.company_id,
      actor_user_id: adminUserId,
      action: 'work_time_model_updated',
      entity_type: 'work_time_model',
      entity_id: validated.id,
      previous_state: {
        name: current.name,
        weekly_hours: current.weekly_hours,
      },
      new_state: updateData,
    });

    revalidatePath('/admin/work-time-models');
    revalidatePath(`/admin/work-time-models/${validated.id}`);

    return {
      success: true,
      message: 'Arbeitszeitmodell aktualisiert',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}

/**
 * Deactivate work time model
 */
export async function deactivateWorkTimeModelAction(modelId: string, adminUserId: string) {
  try {
    const canDelete = await hasPermission(adminUserId, 'settings.write');
    if (!canDelete) {
      return {
        success: false,
        error: 'Keine Berechtigung',
      };
    }

    const { data: model } = await supabase
      .from('work_time_models')
      .select('*')
      .eq('id', modelId)
      .single();

    if (!model) {
      return {
        success: false,
        error: 'Modell nicht gefunden',
      };
    }

    // Check if model is in use
    const { data: employees } = await supabase
      .from('employee_details')
      .select('id')
      .eq('work_time_model_id', modelId)
      .limit(1);

    if (employees && employees.length > 0) {
      return {
        success: false,
        error: 'Modell ist noch Mitarbeitern zugeordnet und kann nicht deaktiviert werden',
      };
    }

    // Deactivate
    const { error: updateError } = await supabase
      .from('work_time_models')
      .update({ is_active: false })
      .eq('id', modelId);

    if (updateError) {
      return {
        success: false,
        error: `Fehler: ${updateError.message}`,
      };
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      company_id: model.company_id,
      actor_user_id: adminUserId,
      action: 'work_time_model_deactivated',
      entity_type: 'work_time_model',
      entity_id: modelId,
    });

    revalidatePath('/admin/work-time-models');

    return {
      success: true,
      message: 'Arbeitszeitmodell deaktiviert',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}
