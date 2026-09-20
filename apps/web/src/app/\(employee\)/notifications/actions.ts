'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUserWithPermissions } from '@/lib/auth-server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ============================================================================
// Validation Schemas
// ============================================================================

const CreateNotificationSchema = z.object({
  recipient_user_id: z.string().uuid().optional(), // If omitted, current user
  notification_type: z.enum([
    'new_shift',
    'shift_changed',
    'shift_cancelled',
    'leave_approved',
    'leave_rejected',
    'leave_requested',
    'new_document',
    'document_approved',
    'company_announcement',
    'absence_recorded',
    'overtime_alert',
    'other',
  ]),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  title: z.string().max(255),
  message: z.string(),
  description: z.string().optional(),
  related_entity_type: z.string().optional(),
  related_entity_id: z.string().uuid().optional(),
  action_url: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

const MarkAsReadSchema = z.object({
  notification_id: z.string().uuid(),
});

const UpdatePreferencesSchema = z.object({
  new_shift_enabled: z.boolean().optional(),
  shift_changed_enabled: z.boolean().optional(),
  shift_cancelled_enabled: z.boolean().optional(),
  leave_approved_enabled: z.boolean().optional(),
  leave_rejected_enabled: z.boolean().optional(),
  leave_requested_enabled: z.boolean().optional(),
  new_document_enabled: z.boolean().optional(),
  document_approved_enabled: z.boolean().optional(),
  company_announcement_enabled: z.boolean().optional(),
  absence_recorded_enabled: z.boolean().optional(),
  overtime_alert_enabled: z.boolean().optional(),
  push_notifications_enabled: z.boolean().optional(),
  email_notifications_enabled: z.boolean().optional(),
  quiet_hours_enabled: z.boolean().optional(),
  quiet_hours_start: z.string().optional(),
  quiet_hours_end: z.string().optional(),
});

// ============================================================================
// Create Notification
// ============================================================================

export async function createNotificationAction(data: unknown) {
  try {
    const validated = CreateNotificationSchema.parse(data);
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    // Only HR can create notifications for others
    if (validated.recipient_user_id && validated.recipient_user_id !== user.id) {
      if (!profile.permissions?.includes('notifications.create')) {
        return { error: 'Permission denied', code: 'FORBIDDEN' };
      }
    }

    const client = createClient();

    // Create notification
    const { data: notification, error: createError } = await client
      .from('notifications')
      .insert({
        company_id: profile.company_id,
        recipient_user_id: validated.recipient_user_id || user.id,
        notification_type: validated.notification_type,
        priority: validated.priority,
        title: validated.title,
        message: validated.message,
        description: validated.description || null,
        related_entity_type: validated.related_entity_type || null,
        related_entity_id: validated.related_entity_id || null,
        action_url: validated.action_url || null,
        metadata: validated.metadata || null,
      })
      .select()
      .single();

    if (createError) {
      console.error('Notification creation error:', createError);
      return { error: 'Failed to create notification', code: 'CREATE_FAILED' };
    }

    return { data: notification };
  } catch (error) {
    console.error('Create notification error:', error);
    return {
      error: error instanceof z.ZodError ? error.errors[0].message : 'Unknown error',
      code: 'VALIDATION_ERROR',
    };
  }
}

// ============================================================================
// Get Notifications
// ============================================================================

export async function getNotificationsAction(limit: number = 50) {
  try {
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const client = createClient();

    // Get recent notifications for user
    const { data: notifications, error } = await client.rpc('get_recent_notifications', {
      p_user_id: user.id,
      p_limit: limit,
    });

    if (error) {
      console.error('Get notifications error:', error);
      return { error: 'Failed to get notifications', code: 'QUERY_FAILED' };
    }

    return { data: notifications || [] };
  } catch (error) {
    console.error('Get notifications error:', error);
    return { error: 'Unknown error', code: 'UNKNOWN' };
  }
}

// ============================================================================
// Get Unread Count
// ============================================================================

export async function getUnreadCountAction() {
  try {
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const client = createClient();

    // Get unread count
    const { data: count, error } = await client.rpc('get_unread_notification_count', {
      p_user_id: user.id,
    });

    if (error) {
      return { error: 'Failed to get count', code: 'QUERY_FAILED' };
    }

    return { data: { unread_count: count } };
  } catch (error) {
    console.error('Get unread count error:', error);
    return { error: 'Unknown error', code: 'UNKNOWN' };
  }
}

// ============================================================================
// Mark as Read
// ============================================================================

export async function markNotificationAsReadAction(data: unknown) {
  try {
    const validated = MarkAsReadSchema.parse(data);
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const client = createClient();

    // Mark as read
    const { data: success, error } = await client.rpc('mark_notification_as_read', {
      p_notification_id: validated.notification_id,
      p_user_id: user.id,
    });

    if (error || !success) {
      return { error: 'Failed to mark as read', code: 'UPDATE_FAILED' };
    }

    revalidatePath('/notifications');
    return { data: { success: true } };
  } catch (error) {
    console.error('Mark as read error:', error);
    return {
      error: error instanceof z.ZodError ? error.errors[0].message : 'Unknown error',
      code: 'VALIDATION_ERROR',
    };
  }
}

// ============================================================================
// Mark All as Read
// ============================================================================

export async function markAllNotificationsAsReadAction() {
  try {
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const client = createClient();

    // Mark all as read
    const { data: count, error } = await client.rpc('mark_all_notifications_as_read', {
      p_user_id: user.id,
    });

    if (error) {
      return { error: 'Failed to mark all as read', code: 'UPDATE_FAILED' };
    }

    revalidatePath('/notifications');
    return { data: { marked_count: count } };
  } catch (error) {
    console.error('Mark all as read error:', error);
    return { error: 'Unknown error', code: 'UNKNOWN' };
  }
}

// ============================================================================
// Get Preferences
// ============================================================================

export async function getNotificationPreferencesAction() {
  try {
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const client = createClient();

    // Get preferences
    const { data: prefs, error } = await client
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .eq('company_id', profile.company_id)
      .single();

    if (error) {
      return { error: 'Failed to get preferences', code: 'QUERY_FAILED' };
    }

    return { data: prefs };
  } catch (error) {
    console.error('Get preferences error:', error);
    return { error: 'Unknown error', code: 'UNKNOWN' };
  }
}

// ============================================================================
// Update Preferences
// ============================================================================

export async function updateNotificationPreferencesAction(data: unknown) {
  try {
    const validated = UpdatePreferencesSchema.parse(data);
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const client = createClient();

    // Update preferences
    const { data: prefs, error } = await client
      .from('notification_preferences')
      .update(validated)
      .eq('user_id', user.id)
      .eq('company_id', profile.company_id)
      .select()
      .single();

    if (error) {
      return { error: 'Failed to update preferences', code: 'UPDATE_FAILED' };
    }

    revalidatePath('/settings/notifications');
    return { data: prefs };
  } catch (error) {
    console.error('Update preferences error:', error);
    return {
      error: error instanceof z.ZodError ? error.errors[0].message : 'Unknown error',
      code: 'VALIDATION_ERROR',
    };
  }
}
