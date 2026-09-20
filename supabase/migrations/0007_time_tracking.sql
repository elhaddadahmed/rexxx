-- Phase 8: Zeiterfassung (Time Tracking)
--
-- Unterstützt:
-- - Start/Ende Zeiten
-- - Pausenmanagement
-- - Sollzeit vs Istzeit
-- - Überstundenkonto
-- - Korrektionen
-- - Historische Arbeitszeitmodelle
-- - Feiertage
-- - Wochenenden
-- - Zeitzonen

CREATE TYPE time_entry_source AS ENUM ('mobile', 'web', 'qr', 'nfc', 'admin');
CREATE TYPE time_entry_status AS ENUM ('in_progress', 'completed', 'corrected', 'approved');

-- ============================================================================
-- 1. TIME ENTRIES – Core time tracking records
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employee_details(id) ON DELETE CASCADE,
  
  date DATE NOT NULL,
  
  -- Start/End times (in employee's timezone)
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  
  -- Calculated fields
  duration_minutes INT, -- Total time including breaks
  break_duration_minutes INT DEFAULT 0, -- Total break time
  net_working_minutes INT, -- duration - break
  
  -- Reference work model
  work_time_model_id UUID REFERENCES public.work_time_models(id),
  expected_duration_minutes INT, -- Sollzeit from work model
  
  -- Status
  status time_entry_status NOT NULL DEFAULT 'in_progress',
  source time_entry_source NOT NULL DEFAULT 'web',
  
  -- Meta
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  
  CONSTRAINT valid_times CHECK (end_time IS NULL OR end_time > start_time),
  CONSTRAINT valid_duration CHECK (duration_minutes IS NULL OR duration_minutes >= 0)
);

CREATE INDEX IF NOT EXISTS idx_time_entries_date ON public.time_entries(date);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_date ON public.time_entries(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_time_entries_company_date ON public.time_entries(company_id, date);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON public.time_entries(status);

-- ============================================================================
-- 2. TIME ENTRY BREAKS – Track individual breaks during work
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.time_entry_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id UUID NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  
  duration_minutes INT NOT NULL,
  break_type VARCHAR(50) DEFAULT 'lunch', -- lunch, coffee, other
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT valid_break CHECK (end_time > start_time AND duration_minutes > 0)
);

CREATE INDEX IF NOT EXISTS idx_time_entry_breaks_entry ON public.time_entry_breaks(time_entry_id);

-- ============================================================================
-- 3. TIME ENTRY CORRECTIONS – Audit trail for corrections
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.time_entry_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  time_entry_id UUID NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  
  corrected_by UUID NOT NULL REFERENCES public.profiles(id),
  correction_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Previous values
  previous_start_time TIMESTAMP WITH TIME ZONE,
  previous_end_time TIMESTAMP WITH TIME ZONE,
  previous_duration_minutes INT,
  previous_break_duration_minutes INT,
  
  -- New values
  new_start_time TIMESTAMP WITH TIME ZONE,
  new_end_time TIMESTAMP WITH TIME ZONE,
  new_duration_minutes INT,
  new_break_duration_minutes INT,
  
  -- Reason
  reason TEXT NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT valid_correction CHECK (reason IS NOT NULL AND LENGTH(reason) > 0)
);

CREATE INDEX IF NOT EXISTS idx_time_entry_corrections_entry ON public.time_entry_corrections(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_time_entry_corrections_company ON public.time_entry_corrections(company_id);

-- ============================================================================
-- 4. OVERTIME ACCOUNTS – Track overtime balance per employee
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.overtime_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employee_details(id) ON DELETE CASCADE,
  
  year INT NOT NULL,
  
  -- Balance in minutes
  balance_minutes INT DEFAULT 0, -- Positive = Überstunden, Negative = Minusstunden
  
  -- Tracking
  hours_worked_minutes INT DEFAULT 0,
  hours_expected_minutes INT DEFAULT 0,
  
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT unique_overtime_account UNIQUE (employee_id, year),
  CONSTRAINT valid_year CHECK (year >= 2000 AND year <= 2100)
);

CREATE INDEX IF NOT EXISTS idx_overtime_accounts_employee_year ON public.overtime_accounts(employee_id, year);

-- ============================================================================
-- 5. TIME ENTRY APPROVALS – Manager approvals for corrections/completions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.time_entry_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  time_entry_id UUID NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  
  requested_by UUID NOT NULL REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  approval_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_approval CHECK (
    (status = 'pending' AND approved_by IS NULL AND approved_at IS NULL)
    OR (status IN ('approved', 'rejected') AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_time_entry_approvals_entry ON public.time_entry_approvals(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_time_entry_approvals_status ON public.time_entry_approvals(status);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entry_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entry_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entry_approvals ENABLE ROW LEVEL SECURITY;

-- time_entries: Employees see own, Managers see team, HR/Admin see all in company
CREATE POLICY "time_entries_select"
  ON public.time_entries FOR SELECT
  USING (
    company_id = public.auth_current_company_id()
    AND (
      -- Own entries
      employee_id IN (SELECT id FROM public.employee_details WHERE user_id = auth.uid())
      -- Manager: see team members
      OR employee_id IN (
        SELECT managed_employee_id FROM public.manager_assignments
        WHERE manager_id IN (SELECT id FROM public.employee_details WHERE user_id = auth.uid())
      )
      -- HR/Admin
      OR public.auth_has_permission('time.read')
    )
  );

CREATE POLICY "time_entries_insert"
  ON public.time_entries FOR INSERT
  WITH CHECK (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('time.create')
  );

CREATE POLICY "time_entries_update"
  ON public.time_entries FOR UPDATE
  USING (
    company_id = public.auth_current_company_id()
    AND (
      -- Own entries (only own, not completed)
      (employee_id IN (SELECT id FROM public.employee_details WHERE user_id = auth.uid())
       AND status != 'approved')
      -- Admin/HR
      OR public.auth_has_permission('time.update')
    )
  );

-- time_entry_breaks: Same as time_entries
CREATE POLICY "time_entry_breaks_select"
  ON public.time_entry_breaks FOR SELECT
  USING (
    time_entry_id IN (SELECT id FROM public.time_entries WHERE company_id = public.auth_current_company_id())
  );

CREATE POLICY "time_entry_breaks_insert"
  ON public.time_entry_breaks FOR INSERT
  WITH CHECK (
    time_entry_id IN (
      SELECT id FROM public.time_entries 
      WHERE company_id = public.auth_current_company_id()
        AND public.auth_has_permission('time.create')
    )
  );

-- time_entry_corrections: Only HR/Managers, immutable
CREATE POLICY "time_entry_corrections_select"
  ON public.time_entry_corrections FOR SELECT
  USING (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('time.read')
  );

CREATE POLICY "time_entry_corrections_insert"
  ON public.time_entry_corrections FOR INSERT
  WITH CHECK (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('time.update')
  );

-- overtime_accounts: Employees see own, HR/Admin see all
CREATE POLICY "overtime_accounts_select"
  ON public.overtime_accounts FOR SELECT
  USING (
    company_id = public.auth_current_company_id()
    AND (
      -- Own account
      employee_id IN (SELECT id FROM public.employee_details WHERE user_id = auth.uid())
      -- HR/Admin
      OR public.auth_has_permission('time.read')
    )
  );

CREATE POLICY "overtime_accounts_update"
  ON public.overtime_accounts FOR UPDATE
  USING (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('time.update')
  );

-- time_entry_approvals: Managers and HR
CREATE POLICY "time_entry_approvals_select"
  ON public.time_entry_approvals FOR SELECT
  USING (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('time.read')
  );

CREATE POLICY "time_entry_approvals_insert"
  ON public.time_entry_approvals FOR INSERT
  WITH CHECK (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('time.read')
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Calculate net working time (end - start - breaks)
CREATE OR REPLACE FUNCTION public.calculate_net_working_minutes(
  p_start_time TIMESTAMP WITH TIME ZONE,
  p_end_time TIMESTAMP WITH TIME ZONE,
  p_break_minutes INT
)
RETURNS INT AS $$
DECLARE
  v_total_minutes INT;
BEGIN
  v_total_minutes := EXTRACT(EPOCH FROM (p_end_time - p_start_time))::INT / 60;
  RETURN GREATEST(0, v_total_minutes - COALESCE(p_break_minutes, 0));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Check if date is working day (not weekend, not holiday)
CREATE OR REPLACE FUNCTION public.is_working_day(
  p_employee_id UUID,
  p_date DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_day_of_week INT;
  v_work_config RECORD;
  v_is_holiday BOOLEAN;
  v_company_id UUID;
BEGIN
  -- Get company
  SELECT company_id INTO v_company_id FROM public.employee_details WHERE id = p_employee_id;
  
  -- Check if holiday
  SELECT is_german_holiday INTO v_is_holiday FROM public.is_german_holiday(p_date, (
    SELECT federal_state FROM public.companies WHERE id = v_company_id
  ));
  
  IF v_is_holiday THEN
    RETURN false;
  END IF;
  
  -- Get work day config
  v_day_of_week := EXTRACT(DOW FROM p_date)::INT; -- 0=Sun, 1=Mon, 6=Sat
  
  SELECT is_working_day INTO v_work_config
  FROM public.work_time_rules
  WHERE day_of_week = v_day_of_week
    AND work_time_model_id = (
      SELECT get_employee_work_time_model(p_employee_id, p_date)
    )
  LIMIT 1;
  
  RETURN COALESCE(v_work_config.is_working_day, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get daily summary for employee
CREATE OR REPLACE FUNCTION public.get_daily_time_summary(
  p_employee_id UUID,
  p_date DATE
)
RETURNS TABLE (
  date DATE,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INT,
  break_duration_minutes INT,
  net_working_minutes INT,
  expected_duration_minutes INT,
  overtime_minutes INT,
  is_working_day BOOLEAN
) AS $$
DECLARE
  v_company_id UUID;
  v_federal_state VARCHAR;
BEGIN
  SELECT company_id INTO v_company_id FROM public.employee_details WHERE id = p_employee_id;
  
  RETURN QUERY
  SELECT 
    te.date,
    te.start_time,
    te.end_time,
    te.duration_minutes,
    te.break_duration_minutes,
    te.net_working_minutes,
    te.expected_duration_minutes,
    COALESCE(te.net_working_minutes - te.expected_duration_minutes, 0),
    public.is_working_day(p_employee_id, p_date)
  FROM public.time_entries te
  WHERE te.employee_id = p_employee_id
    AND te.date = p_date
    AND te.status IN ('completed', 'approved')
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get weekly summary
CREATE OR REPLACE FUNCTION public.get_weekly_time_summary(
  p_employee_id UUID,
  p_start_date DATE
)
RETURNS TABLE (
  week_start DATE,
  hours_worked INT,
  hours_expected INT,
  overtime_minutes INT,
  days_worked INT,
  working_days INT
) AS $$
BEGIN
  RETURN QUERY
  WITH week_data AS (
    SELECT 
      date_trunc('week', te.date)::date as week_start,
      SUM(te.net_working_minutes) FILTER (WHERE te.status IN ('completed', 'approved')) as hours_worked_minutes,
      SUM(te.expected_duration_minutes) FILTER (WHERE te.status IN ('completed', 'approved')) as hours_expected_minutes,
      COUNT(DISTINCT te.date) FILTER (WHERE te.status IN ('completed', 'approved')) as days_worked
    FROM public.time_entries te
    WHERE te.employee_id = p_employee_id
      AND date_trunc('week', te.date)::date = date_trunc('week', p_start_date)::date
    GROUP BY date_trunc('week', te.date)
  ),
  working_days AS (
    SELECT COUNT(*) as count FROM (
      SELECT generate_series(p_start_date, p_start_date + 6, '1 day'::interval)::date as d
    ) dates
    WHERE public.is_working_day(p_employee_id, d)
  )
  SELECT 
    week_start,
    (hours_worked_minutes / 60)::INT,
    (hours_expected_minutes / 60)::INT,
    (hours_worked_minutes - hours_expected_minutes)::INT,
    days_worked,
    (SELECT count FROM working_days)
  FROM week_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DONE – Phase 8 Time Tracking
-- ============================================================================

SELECT 'Phase 8: Time Tracking tables created with calculations and helper functions' as status;
