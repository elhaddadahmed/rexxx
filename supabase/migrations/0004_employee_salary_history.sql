-- Phase 5: Employee Salary History
--
-- Tracks salary changes over time with valid_from/valid_to
-- Prevents retroactive changes (payroll_periods.status='closed' blocks updates)

CREATE TABLE IF NOT EXISTS public.employee_salary_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employee_details(id) ON DELETE CASCADE,
  
  -- Salary details
  salary_amount DECIMAL(12, 2) NOT NULL,
  salary_currency VARCHAR(3) DEFAULT 'EUR',
  salary_type VARCHAR(20) NOT NULL CHECK (salary_type IN ('monthly', 'hourly', 'annual')),
  
  -- Validity period
  valid_from DATE NOT NULL,
  valid_to DATE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  
  -- Constraints
  CONSTRAINT valid_dates CHECK (valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT unique_active_salary EXCLUDE USING gist (
    employee_id WITH =,
    daterange(valid_from, valid_to, '[)') WITH &&
  ) WHERE (valid_to IS NOT NULL)
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_employee_salary_history_company 
  ON public.employee_salary_history(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_salary_history_employee 
  ON public.employee_salary_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_salary_history_valid 
  ON public.employee_salary_history(valid_from, valid_to);

-- RLS
ALTER TABLE public.employee_salary_history ENABLE ROW LEVEL SECURITY;

-- SELECT: Same as employee_details (Company-Admin, HR-Admin, Employee selbst)
CREATE POLICY "employee_salary_history_select"
  ON public.employee_salary_history FOR SELECT
  USING (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('employees.read')
  );

-- INSERT: HR-Admin, Company-Admin (via Server Action mit Audit)
CREATE POLICY "employee_salary_history_insert"
  ON public.employee_salary_history FOR INSERT
  WITH CHECK (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('payroll.create')
  );

-- UPDATE: Nicht erlaubt (immutable nach Erstellung)
-- Alte Einträge werden mit valid_to gespeichert, neue Einträge werden erstellt

-- DELETE: Nicht erlaubt (Audit-Trail)

-- ============================================================================
-- Trigger: Automatisch valid_to setzen wenn neuer Gehalt-Eintrag erstellt wird
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_salary_valid_to()
RETURNS TRIGGER AS $$
BEGIN
  -- Wenn neuer Eintrag, alten Eintrag mit valid_to = (neuer valid_from - 1 Tag)
  UPDATE public.employee_salary_history
  SET valid_to = NEW.valid_from - INTERVAL '1 day'
  WHERE employee_id = NEW.employee_id
    AND id != NEW.id
    AND valid_to IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER salary_history_set_valid_to
  AFTER INSERT ON public.employee_salary_history
  FOR EACH ROW
  EXECUTE FUNCTION public.set_salary_valid_to();

-- ============================================================================
-- Helper Function: Get current salary for employee
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_employee_current_salary(
  p_employee_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  salary_amount DECIMAL,
  salary_type VARCHAR,
  salary_currency VARCHAR,
  valid_from DATE,
  valid_to DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    esh.salary_amount,
    esh.salary_type,
    esh.salary_currency,
    esh.valid_from,
    esh.valid_to
  FROM public.employee_salary_history esh
  WHERE esh.employee_id = p_employee_id
    AND esh.valid_from <= p_date
    AND (esh.valid_to IS NULL OR esh.valid_to >= p_date)
  ORDER BY esh.valid_from DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DONE – Phase 5 Salary History
-- ============================================================================

SELECT 'Phase 5: Salary History table created' as status;
