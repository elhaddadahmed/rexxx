'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUserWithPermissions } from '@/lib/auth-server';
import { z } from 'zod';

// ============================================================================
// Validation Schemas
// ============================================================================

const CreateLeaveRequestSchema = z.object({
  employee_id: z.string().uuid(),
  leave_type_id: z.string().uuid(),
  start_date: z.string().date(),
  end_date: z.string().date(),
  reason: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
});

const ApproveLeaveRequestSchema = z.object({
  leave_request_id: z.string().uuid(),
  comment: z.string().max(500).optional(),
});

const RejectLeaveRequestSchema = z.object({
  leave_request_id: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

const CancelLeaveRequestSchema = z.object({
  leave_request_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

const GetLeaveBalanceSchema = z.object({
  employee_id: z.string().uuid(),
  leave_type_id: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
});

// ============================================================================
// Create Leave Request
// ============================================================================

export async function createLeaveRequestAction(data: unknown) {
  try {
    const validated = CreateLeaveRequestSchema.parse(data);
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    // Permission check
    if (!profile.permissions?.includes('leave.request')) {
      return { error: 'Permission denied: leave.request', code: 'FORBIDDEN' };
    }

    // Validate date range
    const start = new Date(validated.start_date);
    const end = new Date(validated.end_date);
    if (end < start) {
      return { error: 'End date must be after or equal to start date', code: 'INVALID_DATE_RANGE' };
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

    // Check leave type exists
    const { data: leaveType, error: typeError } = await client
      .from('leave_types')
      .select('id, max_days_per_year')
      .eq('id', validated.leave_type_id)
      .eq('company_id', profile.company_id)
      .single();

    if (typeError || !leaveType) {
      return { error: 'Leave type not found', code: 'NOT_FOUND' };
    }

    // Calculate working days
    const { data: workingDays, error: calcError } = await client.rpc(
      'calculate_working_days',
      {
        p_employee_id: validated.employee_id,
        p_start_date: validated.start_date,
        p_end_date: validated.end_date,
      }
    );

    if (calcError || workingDays === null) {
      console.error('Working days calculation error:', calcError);
      return { error: 'Failed to calculate working days', code: 'CALC_ERROR' };
    }

    // Check against max days
    if (leaveType.max_days_per_year && workingDays > leaveType.max_days_per_year) {
      return {
        error: `Cannot request more than ${leaveType.max_days_per_year} days for this leave type`,
        code: 'EXCEEDS_LIMIT',
      };
    }

    // Check available balance
    const year = new Date(validated.start_date).getFullYear();
    const { data: balance } = await client.rpc('get_leave_balance', {
      p_employee_id: validated.employee_id,
      p_leave_type_id: validated.leave_type_id,
      p_year: year,
    });

    if (balance && balance[0]) {
      const { remaining_days } = balance[0];
      if (workingDays > remaining_days) {
        return {
          error: `Only ${remaining_days} days available. Requested: ${workingDays}`,
          code: 'INSUFFICIENT_BALANCE',
        };
      }
    }

    // Create leave request
    const { data: leaveRequest, error: createError } = await client
      .from('leave_requests')
      .insert({
        company_id: profile.company_id,
        employee_id: validated.employee_id,
        leave_type_id: validated.leave_type_id,
        start_date: validated.start_date,
        end_date: validated.end_date,
        working_days: workingDays,
        reason: validated.reason || null,
        notes: validated.notes || null,
        status: 'requested',
      })
      .select()
      .single();

    if (createError) {
      console.error('Leave request creation error:', createError);
      return { error: 'Failed to create leave request', code: 'CREATE_FAILED' };
    }

    // Audit log
    await client.from('audit_logs').insert({
      company_id: profile.company_id,
      actor_user_id: user.id,
      action: 'leave_request_created',
      entity_type: 'leave_request',
      entity_id: leaveRequest.id,
      new_state: {
        employee_id: validated.employee_id,
        start_date: validated.start_date,
        end_date: validated.end_date,
        working_days: workingDays,
      },
    });

    revalidatePath('/leave');
    return { data: leaveRequest };
  } catch (error) {
    console.error('Create leave request error:', error);
    return {
      error: error instanceof z.ZodError ? error.errors[0].message : 'Unknown error',
      code: 'VALIDATION_ERROR',
    };
  }
}

// ============================================================================
// Approve Leave Request
// ============================================================================

export async function approveLeaveRequestAction(data: unknown) {
  try {
    const validated = ApproveLeaveRequestSchema.parse(data);
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    // Permission check
    if (!profile.permissions?.includes('leave.approve')) {
      return { error: 'Permission denied: leave.approve', code: 'FORBIDDEN' };
    }

    const client = createClient();

    // Get leave request
    const { data: leaveRequest, error: getError } = await client
      .from('leave_requests')
      .select('*')
      .eq('id', validated.leave_request_id)
      .eq('company_id', profile.company_id)
      .single();

    if (getError || !leaveRequest) {
      return { error: 'Leave request not found', code: 'NOT_FOUND' };
    }

    if (leaveRequest.status !== 'requested') {
      return { error: 'Only pending requests can be approved', code: 'INVALID_STATUS' };
    }

    // Update leave request
    const { data: updated, error: updateError } = await client
      .from('leave_requests')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', validated.leave_request_id)
      .select()
      .single();

    if (updateError) {
      console.error('Leave request update error:', updateError);
      return { error: 'Failed to approve leave request', code: 'UPDATE_FAILED' };
    }

    // Create leave approval record
    await client.from('leave_approvals').insert({
      company_id: profile.company_id,
      leave_request_id: validated.leave_request_id,
      approved_by: user.id,
      action: 'approved',
      comment: validated.comment || null,
    });

    // Create absence records for each day
    const startDate = new Date(leaveRequest.start_date);
    const endDate = new Date(leaveRequest.end_date);
    const absenceRecords = [];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      // Check if working day
      const { data: isWorking } = await client.rpc('is_working_day', {
        p_employee_id: leaveRequest.employee_id,
        p_date: dateStr,
      });

      if (isWorking) {
        absenceRecords.push({
          company_id: profile.company_id,
          employee_id: leaveRequest.employee_id,
          leave_request_id: validated.leave_request_id,
          date: dateStr,
          absence_type: 'vacation', // Will be determined by leave_type
          is_working_day: true,
        });
      }
    }

    if (absenceRecords.length > 0) {
      await client.from('absence_records').insert(absenceRecords);
    }

    // Update leave balance
    const year = new Date(leaveRequest.start_date).getFullYear();
    const { data: balance } = await client
      .from('leave_balances')
      .select('*')
      .eq('employee_id', leaveRequest.employee_id)
      .eq('leave_type_id', leaveRequest.leave_type_id)
      .eq('year', year)
      .single();

    if (balance) {
      await client
        .from('leave_balances')
        .update({
          used_days: balance.used_days + leaveRequest.working_days,
          remaining_days: Math.max(0, balance.entitled_days - (balance.used_days + leaveRequest.working_days)),
          last_updated: new Date().toISOString(),
        })
        .eq('id', balance.id);
    }

    // Audit log
    await client.from('audit_logs').insert({
      company_id: profile.company_id,
      actor_user_id: user.id,
      action: 'leave_request_approved',
      entity_type: 'leave_request',
      entity_id: validated.leave_request_id,
      new_state: { status: 'approved', approved_by: user.id },
    });

    revalidatePath('/leave');
    return { data: updated };
  } catch (error) {
    console.error('Approve leave request error:', error);
    return {
      error: error instanceof z.ZodError ? error.errors[0].message : 'Unknown error',
      code: 'VALIDATION_ERROR',
    };
  }
}

// ============================================================================
// Reject Leave Request
// ============================================================================

export async function rejectLeaveRequestAction(data: unknown) {
  try {
    const validated = RejectLeaveRequestSchema.parse(data);
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    if (!profile.permissions?.includes('leave.approve')) {
      return { error: 'Permission denied: leave.approve', code: 'FORBIDDEN' };
    }

    const client = createClient();

    // Get leave request
    const { data: leaveRequest, error: getError } = await client
      .from('leave_requests')
      .select('*')
      .eq('id', validated.leave_request_id)
      .eq('company_id', profile.company_id)
      .single();

    if (getError || !leaveRequest) {
      return { error: 'Leave request not found', code: 'NOT_FOUND' };
    }

    if (leaveRequest.status !== 'requested') {
      return { error: 'Only pending requests can be rejected', code: 'INVALID_STATUS' };
    }

    // Update leave request
    const { data: updated, error: updateError } = await client
      .from('leave_requests')
      .update({
        status: 'rejected',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', validated.leave_request_id)
      .select()
      .single();

    if (updateError) {
      console.error('Leave request rejection error:', updateError);
      return { error: 'Failed to reject leave request', code: 'UPDATE_FAILED' };
    }

    // Create leave approval record
    await client.from('leave_approvals').insert({
      company_id: profile.company_id,
      leave_request_id: validated.leave_request_id,
      approved_by: user.id,
      action: 'rejected',
      reason: validated.reason,
    });

    // Audit log
    await client.from('audit_logs').insert({
      company_id: profile.company_id,
      actor_user_id: user.id,
      action: 'leave_request_rejected',
      entity_type: 'leave_request',
      entity_id: validated.leave_request_id,
      new_state: { status: 'rejected', reason: validated.reason },
    });

    revalidatePath('/leave');
    return { data: updated };
  } catch (error) {
    console.error('Reject leave request error:', error);
    return {
      error: error instanceof z.ZodError ? error.errors[0].message : 'Unknown error',
      code: 'VALIDATION_ERROR',
    };
  }
}

// ============================================================================
// Get Leave Balance
// ============================================================================

export async function getLeaveBalanceAction(data: unknown) {
  try {
    const validated = GetLeaveBalanceSchema.parse(data);
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const client = createClient();

    const { data: balance, error } = await client.rpc('get_leave_balance', {
      p_employee_id: validated.employee_id,
      p_leave_type_id: validated.leave_type_id,
      p_year: validated.year,
    });

    if (error) {
      console.error('Get balance error:', error);
      return { error: 'Failed to get leave balance', code: 'QUERY_FAILED' };
    }

    return { data: balance?.[0] || null };
  } catch (error) {
    console.error('Get leave balance error:', error);
    return {
      error: error instanceof z.ZodError ? error.errors[0].message : 'Unknown error',
      code: 'VALIDATION_ERROR',
    };
  }
}

// ============================================================================
// Get Pending Leave Requests (for Manager)
// ============================================================================

export async function getPendingLeaveRequestsAction() {
  try {
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const client = createClient();

    // Get manager's employee ID
    const { data: managerEmployee } = await client
      .from('employee_details')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!managerEmployee) {
      return { data: [] };
    }

    const { data: requests, error } = await client.rpc('get_pending_leave_requests', {
      p_manager_id: managerEmployee.id,
    });

    if (error) {
      console.error('Get pending requests error:', error);
      return { error: 'Failed to get pending requests', code: 'QUERY_FAILED' };
    }

    return { data: requests || [] };
  } catch (error) {
    console.error('Get pending leave requests error:', error);
    return { error: 'Unknown error', code: 'UNKNOWN' };
  }
}

// ============================================================================
// Get Leave Requests (List)
// ============================================================================

export async function getLeaveRequestsAction(
  employeeId: string,
  year: number,
  status?: string,
) {
  try {
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    if (!profile.permissions?.includes('leave.read')) {
      return { error: 'Permission denied: leave.read', code: 'FORBIDDEN' };
    }

    const client = createClient();

    let query = client
      .from('leave_requests')
      .select('*, leave_types(name)')
      .eq('employee_id', employeeId)
      .eq('company_id', profile.company_id)
      .gte('start_date', `${year}-01-01`)
      .lte('end_date', `${year}-12-31`);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: requests, error } = await query.order('start_date', { ascending: false });

    if (error) {
      console.error('Get leave requests error:', error);
      return { error: 'Failed to get leave requests', code: 'QUERY_FAILED' };
    }

    return { data: requests || [] };
  } catch (error) {
    console.error('Get leave requests error:', error);
    return { error: 'Unknown error', code: 'UNKNOWN' };
  }
}

import { revalidatePath } from 'next/cache';
