-- Phase 9: Urlaub & Abwesenheiten (Leave & Absences)
--
-- Unterstützt:
-- - Urlaubstypen (Urlaub, Krankheit, Fortbildung, etc.)
-- - Urlaubsanträge mit Genehmigungsprozess
-- - Urlaubssaldo pro Jahr
-- - Historische Records
-- - Integration mit Time Tracking
-- - Tägliche Abwesenheitsaufzeichnungen

CREATE TYPE leave_status AS ENUM ('requested', 'approved', 'rejected', 'cancelled', 'completed');
CREATE TYPE absence_type AS ENUM ('vacation', 'sick_leave', 'training', 'unpaid_leave', 'parental_leave', 'other');

-- ============================================================================
-- 1. LEAVE TYPES – Definieren Sie Urlaubstypen
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  name VARCHAR(100) NOT NULL, -- z.B. "Urlaub", "Krankheit"
  description TEXT,
  
  -- Konfiguration
  requires_approval BOOLEAN DEFAULT TRUE, -- Braucht Manager-Genehmigung?
  is_paid BOOLEAN DEFAULT TRUE, -- Bezahlter oder unbezahlter Urlaub?
  max_days_per_year INT, -- Max Tage pro Jahr (null = unbegrenzt)
  requires_certificate BOOLEAN DEFAULT FALSE, -- Krankmeldung erforderlich?
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT unique_leave_type_name UNIQUE (company_id, name),
  CONSTRAINT valid_max_days CHECK (max_days_per_year IS NULL OR max_days_per_year > 0)
);

CREATE INDEX IF NOT EXISTS idx_leave_types_company ON public.leave_types(company_id);

-- ============================================================================
-- 2. LEAVE BALANCES – Saldo pro Mitarbeiter + Jahr
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employee_details(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  
  year INT NOT NULL,
  
  -- Balance
  entitled_days INT DEFAULT 0, -- Anspruch (z.B. 30 Tage Urlaub)
  used_days INT DEFAULT 0, -- Verwendete Tage
  remaining_days INT DEFAULT 0, -- Verbleibende Tage (calculated)
  
  -- Carryover from previous year
  carryover_days INT DEFAULT 0, -- Resturlaub vom Vorjahr
  carryover_deadline DATE, -- Bis wann Resturlaub nehmen? (z.B. 31.03)
  
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT unique_leave_balance UNIQUE (employee_id, leave_type_id, year),
  CONSTRAINT valid_year CHECK (year >= 2000 AND year <= 2100),
  CONSTRAINT valid_balance CHECK (remaining_days >= 0)
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_year ON public.leave_balances(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_leave_balances_company ON public.leave_balances(company_id);

-- ============================================================================
-- 3. LEAVE REQUESTS – Urlaubsanträge von Mitarbeitern
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employee_details(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Calculated
  working_days INT NOT NULL, -- Anzahl Arbeitstage (ohne Wochenende, ohne Feiertage)
  
  status leave_status NOT NULL DEFAULT 'requested',
  
  -- Notes
  reason TEXT, -- Begründung (optional)
  notes TEXT, -- Interne Notizen
  
  -- Workflow
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  -- Attachments (für Krankmeldung, etc.)
  attachment_url TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT valid_dates CHECK (end_date >= start_date),
  CONSTRAINT valid_working_days CHECK (working_days >= 0),
  CONSTRAINT valid_approval CHECK (
    (status = 'requested' AND approved_by IS NULL)
    OR (status IN ('approved', 'rejected') AND approved_by IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_company ON public.leave_requests(company_id);

-- ============================================================================
-- 4. LEAVE APPROVALS – Audit trail für Genehmigungsprozess
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.leave_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  leave_request_id UUID NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  
  approved_by UUID NOT NULL REFERENCES public.profiles(id),
  action leave_status NOT NULL, -- 'approved', 'rejected', 'cancelled'
  
  reason TEXT, -- Begründung für Ablehnung
  comment TEXT, -- Allgemeiner Kommentar
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT valid_action CHECK (action IN ('approved', 'rejected', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_leave_approvals_request ON public.leave_approvals(leave_request_id);
CREATE INDEX IF NOT EXISTS idx_leave_approvals_company ON public.leave_approvals(company_id);

-- ============================================================================
-- 5. ABSENCE RECORDS – Tägliche Abwesenheitsaufzeichnungen
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.absence_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employee_details(id) ON DELETE CASCADE,
  leave_request_id UUID REFERENCES public.leave_requests(id) ON DELETE SET NULL,
  
  date DATE NOT NULL,
  absence_type absence_type NOT NULL DEFAULT 'vacation',
  
  is_working_day BOOLEAN DEFAULT TRUE, -- War das ein Arbeitstag?
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT unique_absence UNIQUE (employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_absence_records_employee_date ON public.absence_records(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_absence_records_company ON public.absence_records(company_id);
CREATE INDEX IF NOT EXISTS idx_absence_records_request ON public.absence_records(leave_request_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absence_records ENABLE ROW LEVEL SECURITY;

-- leave_types: Read by all, Write by admin
CREATE POLICY "leave_types_select"
  ON public.leave_types FOR SELECT
  USING (company_id = public.auth_current_company_id());

CREATE POLICY "leave_types_insert"
  ON public.leave_types FOR INSERT
  WITH CHECK (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('settings.write')
  );

-- leave_balances: Employee sees own, HR sees all
CREATE POLICY "leave_balances_select"
  ON public.leave_balances FOR SELECT
  USING (
    company_id = public.auth_current_company_id()
    AND (
      -- Own balance
      employee_id IN (SELECT id FROM public.employee_details WHERE user_id = auth.uid())
      -- HR/Admin
      OR public.auth_has_permission('leave.read')
    )
  );

CREATE POLICY "leave_balances_update"
  ON public.leave_balances FOR UPDATE
  USING (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('leave.update')
  );

-- leave_requests: Employee sees own, Manager sees team, HR sees all
CREATE POLICY "leave_requests_select"
  ON public.leave_requests FOR SELECT
  USING (
    company_id = public.auth_current_company_id()
    AND (
      -- Own requests
      employee_id IN (SELECT id FROM public.employee_details WHERE user_id = auth.uid())
      -- Manager: team
      OR employee_id IN (
        SELECT managed_employee_id FROM public.manager_assignments
        WHERE manager_id IN (SELECT id FROM public.employee_details WHERE user_id = auth.uid())
      )
      -- HR/Admin
      OR public.auth_has_permission('leave.read')
    )
  );

CREATE POLICY "leave_requests_insert"
  ON public.leave_requests FOR INSERT
  WITH CHECK (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('leave.request')
  );

CREATE POLICY "leave_requests_update"
  ON public.leave_requests FOR UPDATE
  USING (
    company_id = public.auth_current_company_id()
    AND (
      -- Only own requests, only if not approved
      (employee_id IN (SELECT id FROM public.employee_details WHERE user_id = auth.uid())
       AND status IN ('requested', 'cancelled'))
      -- Admin
      OR public.auth_has_permission('leave.update')
    )
  );

-- leave_approvals: Only HR/Managers
CREATE POLICY "leave_approvals_select"
  ON public.leave_approvals FOR SELECT
  USING (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('leave.read')
  );

CREATE POLICY "leave_approvals_insert"
  ON public.leave_approvals FOR INSERT
  WITH CHECK (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('leave.approve')
  );

-- absence_records: Employee owns, HR sees all
CREATE POLICY "absence_records_select"
  ON public.absence_records FOR SELECT
  USING (
    company_id = public.auth_current_company_id()
    AND (
      employee_id IN (SELECT id FROM public.employee_details WHERE user_id = auth.uid())
      OR public.auth_has_permission('leave.read')
    )
  );

CREATE POLICY "absence_records_insert"
  ON public.absence_records FOR INSERT
  WITH CHECK (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('leave.update')
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get leave balance for employee
CREATE OR REPLACE FUNCTION public.get_leave_balance(
  p_employee_id UUID,
  p_leave_type_id UUID,
  p_year INT
)
RETURNS TABLE (
  entitled_days INT,
  used_days INT,
  remaining_days INT,
  carryover_days INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lb.entitled_days,
    lb.used_days,
    GREATEST(0, (lb.entitled_days + COALESCE(lb.carryover_days, 0)) - lb.used_days),
    lb.carryover_days
  FROM public.leave_balances lb
  WHERE lb.employee_id = p_employee_id
    AND lb.leave_type_id = p_leave_type_id
    AND lb.year = p_year
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if employee is on leave for date
CREATE OR REPLACE FUNCTION public.is_on_leave(
  p_employee_id UUID,
  p_date DATE
)
RETURNS TABLE (
  is_on_leave BOOLEAN,
  leave_type absence_type,
  request_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE((SELECT true 
      FROM public.absence_records 
      WHERE employee_id = p_employee_id 
        AND date = p_date
      LIMIT 1), false),
    (SELECT absence_type 
      FROM public.absence_records 
      WHERE employee_id = p_employee_id 
        AND date = p_date
      LIMIT 1),
    (SELECT leave_request_id 
      FROM public.absence_records 
      WHERE employee_id = p_employee_id 
        AND date = p_date
      LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate working days between dates (excluding weekends + holidays)
CREATE OR REPLACE FUNCTION public.calculate_working_days(
  p_employee_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS INT AS $$
DECLARE
  v_working_days INT := 0;
  v_current_date DATE := p_start_date;
BEGIN
  WHILE v_current_date <= p_end_date LOOP
    -- Check if working day
    IF public.is_working_day(p_employee_id, v_current_date) THEN
      v_working_days := v_working_days + 1;
    END IF;
    v_current_date := v_current_date + 1;
  END LOOP;
  
  RETURN v_working_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get pending leave requests for manager
CREATE OR REPLACE FUNCTION public.get_pending_leave_requests(
  p_manager_id UUID
)
RETURNS TABLE (
  request_id UUID,
  employee_id UUID,
  employee_name VARCHAR,
  leave_type_name VARCHAR,
  start_date DATE,
  end_date DATE,
  working_days INT,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lr.id,
    lr.employee_id,
    (ed.first_name || ' ' || ed.last_name)::VARCHAR,
    lt.name,
    lr.start_date,
    lr.end_date,
    lr.working_days,
    lr.reason
  FROM public.leave_requests lr
  JOIN public.leave_types lt ON lr.leave_type_id = lt.id
  JOIN public.employee_details ed ON lr.employee_id = ed.id
  WHERE lr.employee_id IN (
    SELECT managed_employee_id FROM public.manager_assignments
    WHERE manager_id = p_manager_id
  )
  AND lr.status = 'requested'
  ORDER BY lr.requested_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SEED DATA – Urlaubstypen
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Get test company
  SELECT id INTO v_company_id FROM public.companies LIMIT 1;
  
  IF v_company_id IS NOT NULL THEN
    -- Insert leave types
    INSERT INTO public.leave_types (company_id, name, description, requires_approval, is_paid, max_days_per_year, requires_certificate, is_active)
    VALUES
      (v_company_id, 'Urlaub', 'Bezahlter Urlaub', TRUE, TRUE, 30, FALSE, TRUE),
      (v_company_id, 'Krankheit', 'Krankheitstage', FALSE, TRUE, NULL, TRUE, TRUE),
      (v_company_id, 'Fortbildung', 'Berufliche Fortbildung', TRUE, TRUE, 5, FALSE, TRUE),
      (v_company_id, 'Unbezahlter Urlaub', 'Unbezahlter Urlaub', TRUE, FALSE, NULL, FALSE, TRUE),
      (v_company_id, 'Elternzeit', 'Elternzeitregelung', TRUE, FALSE, NULL, FALSE, TRUE)
    ON CONFLICT (company_id, name) DO NOTHING;
    
    RAISE NOTICE 'Leave types seeded';
  END IF;
END $$;

-- ============================================================================
-- DONE – Phase 9 Leave & Absences
-- ============================================================================

SELECT 'Phase 9: Leave & Absences tables created with workflow and helper functions' as status;
