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

const createEmployeeSchema = z.object({
  profile_id: z.string().uuid('Ungültige Profil-ID'),
  employee_number: z.string().min(1, 'Personalnummer erforderlich'),
  position_title: z.string().min(1, 'Position erforderlich'),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'temporary']),
  hired_at: z.coerce.date('Einstellungsdatum erforderlich'),
  department_id: z.string().uuid('Abteilung erforderlich'),
  manager_id: z.string().uuid('Ungültige Manager-ID').optional().nullable(),
  work_time_model_id: z.string().uuid().optional().nullable(),
});

const updateEmployeeSchema = z.object({
  employee_id: z.string().uuid(),
  position_title: z.string().min(1).optional(),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'temporary']).optional(),
  department_id: z.string().uuid().optional(),
  manager_id: z.string().uuid().optional().nullable(),
});

type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

/**
 * Create new employee
 */
export async function createEmployeeAction(input: CreateEmployeeInput, adminUserId: string) {
  try {
    // Permission check
    const canCreate = await hasPermission(adminUserId, 'employees.create');
    if (!canCreate) {
      return {
        success: false,
        error: 'Keine Berechtigung zum Erstellen von Mitarbeitern',
      };
    }

    // Validation
    const validated = createEmployeeSchema.parse(input);

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

    // Create employee_details
    const { data: employee, error: createError } = await supabase
      .from('employee_details')
      .insert({
        profile_id: validated.profile_id,
        company_id: adminProfile.company_id,
        employee_number: validated.employee_number,
        position_title: validated.position_title,
        employment_type: validated.employment_type,
        hired_at: validated.hired_at.toISOString(),
        department_id: validated.department_id,
        manager_id: validated.manager_id || null,
        work_time_model_id: validated.work_time_model_id || null,
      })
      .select()
      .single();

    if (createError) {
      return {
        success: false,
        error: `Fehler beim Erstellen: ${createError.message}`,
      };
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      company_id: adminProfile.company_id,
      actor_user_id: adminUserId,
      action: 'employee_created',
      entity_type: 'employee',
      entity_id: employee.id,
      metadata: {
        employee_number: validated.employee_number,
        position_title: validated.position_title,
      },
    });

    revalidatePath('/admin/employees');

    return {
      success: true,
      employeeId: employee.id,
      message: `Mitarbeiter ${validated.employee_number} erstellt`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}

/**
 * Update employee
 */
export async function updateEmployeeAction(input: UpdateEmployeeInput, adminUserId: string) {
  try {
    // Permission check
    const canUpdate = await hasPermission(adminUserId, 'employees.update');
    if (!canUpdate) {
      return {
        success: false,
        error: 'Keine Berechtigung zum Bearbeiten von Mitarbeitern',
      };
    }

    const validated = updateEmployeeSchema.parse(input);

    // Get current state
    const { data: currentEmployee } = await supabase
      .from('employee_details')
      .select('*')
      .eq('id', validated.employee_id)
      .single();

    if (!currentEmployee) {
      return {
        success: false,
        error: 'Mitarbeiter nicht gefunden',
      };
    }

    // Prepare update data
    const updateData: any = {};
    if (validated.position_title) updateData.position_title = validated.position_title;
    if (validated.employment_type) updateData.employment_type = validated.employment_type;
    if (validated.department_id) updateData.department_id = validated.department_id;
    if (validated.manager_id !== undefined) updateData.manager_id = validated.manager_id;

    // Update
    const { error: updateError } = await supabase
      .from('employee_details')
      .update(updateData)
      .eq('id', validated.employee_id);

    if (updateError) {
      return {
        success: false,
        error: `Update-Fehler: ${updateError.message}`,
      };
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      company_id: currentEmployee.company_id,
      actor_user_id: adminUserId,
      action: 'employee_updated',
      entity_type: 'employee',
      entity_id: validated.employee_id,
      previous_state: {
        position_title: currentEmployee.position_title,
        employment_type: currentEmployee.employment_type,
        department_id: currentEmployee.department_id,
      },
      new_state: updateData,
    });

    revalidatePath('/admin/employees');
    revalidatePath(`/admin/employees/${validated.employee_id}`);

    return {
      success: true,
      message: 'Mitarbeiter aktualisiert',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}

/**
 * Deactivate employee (soft delete)
 */
export async function deactivateEmployeeAction(employeeId: string, adminUserId: string) {
  try {
    const canDelete = await hasPermission(adminUserId, 'employees.delete');
    if (!canDelete) {
      return {
        success: false,
        error: 'Keine Berechtigung zum Löschen von Mitarbeitern',
      };
    }

    const { data: employee } = await supabase
      .from('employee_details')
      .select('*')
      .eq('id', employeeId)
      .single();

    if (!employee) {
      return {
        success: false,
        error: 'Mitarbeiter nicht gefunden',
      };
    }

    // Soft delete: Mark as deactivated
    const { error: updateError } = await supabase
      .from('employee_details')
      .update({ status: 'deactivated', deactivated_at: new Date().toISOString() })
      .eq('id', employeeId);

    if (updateError) {
      return {
        success: false,
        error: `Deaktivierungsfehler: ${updateError.message}`,
      };
    }

    // Also deactivate the profile
    await supabase
      .from('profiles')
      .update({ status: 'deactivated' })
      .eq('id', employee.profile_id);

    // Audit log
    await supabase.from('audit_logs').insert({
      company_id: employee.company_id,
      actor_user_id: adminUserId,
      action: 'employee_deactivated',
      entity_type: 'employee',
      entity_id: employeeId,
    });

    revalidatePath('/admin/employees');

    return {
      success: true,
      message: 'Mitarbeiter deaktiviert',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}
