-- Phase 12: Benachrichtigungen (Notifications)
--
-- Unterstützt:
-- - In-App Notification Center
-- - Benachrichtigungstypen (Schicht, Urlaub, Dokument, etc.)
-- - Gelesen/Ungelesen Tracking
-- - Real-time Updates (Supabase Realtime)
-- - Audit Trail

CREATE TYPE notification_type AS ENUM (
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
  'other'
);

CREATE TYPE notification_priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);

-- ============================================================================
-- 1. NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Recipient
  recipient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Content
  notification_type notification_type NOT NULL,
  priority notification_priority NOT NULL DEFAULT 'normal',
  
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  description TEXT,
  
  -- Related entity
  related_entity_type VARCHAR(50), -- 'shift', 'leave', 'document', 'employee', etc.
  related_entity_id UUID, -- ID of related shift, leave request, etc.
  
  -- Action URL
  action_url VARCHAR(500),
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  metadata JSONB,
  
  -- Soft delete
  archived_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT valid_read_timestamp CHECK (
    (is_read = TRUE AND read_at IS NOT NULL) OR
    (is_read = FALSE AND read_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_notifications_company ON public.notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON public.notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_related_entity ON public.notifications(related_entity_type, related_entity_id);

-- ============================================================================
-- 2. NOTIFICATION PREFERENCES (User-specific)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Notification enable/disable per type
  new_shift_enabled BOOLEAN DEFAULT TRUE,
  shift_changed_enabled BOOLEAN DEFAULT TRUE,
  shift_cancelled_enabled BOOLEAN DEFAULT TRUE,
  leave_approved_enabled BOOLEAN DEFAULT TRUE,
  leave_rejected_enabled BOOLEAN DEFAULT TRUE,
  leave_requested_enabled BOOLEAN DEFAULT TRUE,
  new_document_enabled BOOLEAN DEFAULT TRUE,
  document_approved_enabled BOOLEAN DEFAULT TRUE,
  company_announcement_enabled BOOLEAN DEFAULT TRUE,
  absence_recorded_enabled BOOLEAN DEFAULT TRUE,
  overtime_alert_enabled BOOLEAN DEFAULT TRUE,
  
  -- Global preferences
  push_notifications_enabled BOOLEAN DEFAULT TRUE,
  email_notifications_enabled BOOLEAN DEFAULT FALSE,
  
  -- Quiet hours (no notifications between times)
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT unique_user_prefs UNIQUE (company_id, user_id),
  CONSTRAINT valid_quiet_hours CHECK (
    (quiet_hours_enabled = FALSE) OR
    (quiet_hours_start IS NOT NULL AND quiet_hours_end IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON public.notification_preferences(user_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- notifications: User sees own notifications, HR sees all
CREATE POLICY "notifications_select"
  ON public.notifications FOR SELECT
  USING (
    company_id = public.auth_current_company_id()
    AND archived_at IS NULL
    AND (
      recipient_user_id = auth.uid()
      OR public.auth_has_permission('notifications.read')
    )
  );

CREATE POLICY "notifications_insert"
  ON public.notifications FOR INSERT
  WITH CHECK (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('notifications.create')
  );

CREATE POLICY "notifications_update"
  ON public.notifications FOR UPDATE
  USING (
    company_id = public.auth_current_company_id()
    AND (
      recipient_user_id = auth.uid() -- User can mark own as read
      OR public.auth_has_permission('notifications.update')
    )
  );

-- notification_preferences: User can manage own, HR can see all
CREATE POLICY "notification_preferences_select"
  ON public.notification_preferences FOR SELECT
  USING (
    company_id = public.auth_current_company_id()
    AND (
      user_id = auth.uid()
      OR public.auth_has_permission('notifications.read')
    )
  );

CREATE POLICY "notification_preferences_update"
  ON public.notification_preferences FOR UPDATE
  USING (
    company_id = public.auth_current_company_id()
    AND (
      user_id = auth.uid()
      OR public.auth_has_permission('notifications.update')
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get unread notification count for user
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(
  p_user_id UUID
)
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.notifications
  WHERE recipient_user_id = p_user_id
    AND is_read = FALSE
    AND archived_at IS NULL;
  
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get recent notifications for user
CREATE OR REPLACE FUNCTION public.get_recent_notifications(
  p_user_id UUID,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  notification_id UUID,
  title VARCHAR,
  message TEXT,
  notification_type notification_type,
  priority notification_priority,
  is_read BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  action_url VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT n.id, n.title, n.message, n.notification_type, n.priority, n.is_read, n.created_at, n.action_url
  FROM public.notifications n
  WHERE n.recipient_user_id = p_user_id
    AND n.archived_at IS NULL
  ORDER BY n.is_read ASC, n.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark notification as read
CREATE OR REPLACE FUNCTION public.mark_notification_as_read(
  p_notification_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_rows INT;
BEGIN
  UPDATE public.notifications
  SET is_read = TRUE, read_at = now(), updated_at = now()
  WHERE id = p_notification_id
    AND recipient_user_id = p_user_id;
  
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark all notifications as read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_as_read(
  p_user_id UUID
)
RETURNS INT AS $$
DECLARE
  v_rows INT;
BEGIN
  UPDATE public.notifications
  SET is_read = TRUE, read_at = now(), updated_at = now()
  WHERE recipient_user_id = p_user_id
    AND is_read = FALSE
    AND archived_at IS NULL;
  
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Auto-create notification preferences on user creation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_notification_preferences_on_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notification_preferences (company_id, user_id)
  VALUES (NEW.company_id, NEW.id)
  ON CONFLICT (company_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_notification_preferences
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION create_notification_preferences_on_user();

-- ============================================================================
-- DONE – Phase 12 Notifications
-- ============================================================================

SELECT 'Phase 12: Notifications tables created' as status;
