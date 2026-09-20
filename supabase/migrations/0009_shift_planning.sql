-- Phase 10: Schichtplanung (Shift Planning)
--
-- Unterstützt:
-- - Schichttypen (Tag, Nacht, Früh, Spät, etc.)
-- - Schichtzuweisungen (Employee ← Shift)
-- - Schicht-Kalender (Tag/Woche/Monat Ansicht)
-- - Konflikt-Erkennung
-- - Integration mit Time Tracking
-- - Manager Benachrichtigungen

CREATE TYPE shift_type AS ENUM ('morning', 'afternoon', 'night', 'rotating', 'flexible', 'on_call');
CREATE TYPE shift_status AS ENUM ('planned', 'confirmed', 'cancelled', 'completed');

-- ============================================================================
-- 1. SHIFT TYPES – Schichttypen definieren
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shift_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  name VARCHAR(100) NOT NULL, -- z.B. "Frühdienst", "Spätdienst"
  description TEXT,
  
  -- Time configuration
  start_time TIME NOT NULL, -- z.B. 06:00
  end_time TIME NOT NULL,   -- z.B. 14:00
  break_duration_minutes INT DEFAULT 30,
  
  -- Shift type
  shift_type shift_type NOT NULL DEFAULT 'morning',
  
  -- Configuration
  is_paid BOOLEAN DEFAULT TRUE,
  requires_manager_approval BOOLEAN DEFAULT FALSE,
  max_employees_per_shift INT, -- Max Mitarbeiter pro Schicht (NULL = unbegrenzt)
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT unique_shift_type_name UNIQUE (company_id, name),
  CONSTRAINT valid_times CHECK (end_time > start_time),
  CONSTRAINT valid_max_employees CHECK (max_employees_per_shift IS NULL OR max_employees_per_shift > 0)
);

CREATE INDEX IF NOT EXISTS idx_shift_types_company ON public.shift_types(company_id);

-- ============================================================================
-- 2. SHIFT ASSIGNMENTS – Schichtzuweisungen
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shift_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employee_details(id) ON DELETE CASCADE,
  shift_type_id UUID NOT NULL REFERENCES public.shift_types(id) ON DELETE CASCADE,
  
  assigned_date DATE NOT NULL,
  
  status shift_status NOT NULL DEFAULT 'planned',
  
  -- Workflow
  assigned_by UUID NOT NULL REFERENCES public.profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  confirmed_by UUID REFERENCES public.profiles(id),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  
  notes TEXT,
  
  -- If this shift is marked complete
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT unique_assignment UNIQUE (employee_id, assigned_date),
  CONSTRAINT valid_status_transition CHECK (
    (status = 'planned' AND confirmed_by IS NULL)
    OR (status IN ('confirmed', 'cancelled', 'completed') AND confirmed_by IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_shift_assignments_employee_date ON public.shift_assignments(employee_id, assigned_date);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_status ON public.shift_assignments(status);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_company ON public.shift_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_date_range ON public.shift_assignments(assigned_date);

-- ============================================================================
-- 3. SHIFT SWAPS – Schichtaustausch-Anfragen
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shift_swaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Original assignment (wer hat diese Schicht)
  original_assignment_id UUID NOT NULL REFERENCES public.shift_assignments(id) ON DELETE CASCADE,
  
  -- Requested swap with
  requested_employee_id UUID NOT NULL REFERENCES public.employee_details(id) ON DELETE CASCADE,
  
  status VARCHAR(50) NOT NULL DEFAULT 'requested', -- requested, accepted, rejected, cancelled
  
  reason TEXT,
  
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  responded_by UUID REFERENCES public.profiles(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT valid_status CHECK (status IN ('requested', 'accepted', 'rejected', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_shift_swaps_assignment ON public.shift_swaps(original_assignment_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_status ON public.shift_swaps(status);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_company ON public.shift_swaps(company_id);

-- ============================================================================
-- 4. SHIFT CONFLICTS – Konflikt-Erkennung
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shift_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- First assignment
  assignment_id_1 UUID NOT NULL REFERENCES public.shift_assignments(id) ON DELETE CASCADE,
  -- Second assignment (same employee, same day)
  assignment_id_2 UUID NOT NULL REFERENCES public.shift_assignments(id) ON DELETE CASCADE,
  
  conflict_type VARCHAR(100) NOT NULL, -- 'overlapping_shifts', 'insufficient_break', 'location_conflict'
  
  severity VARCHAR(50) NOT NULL DEFAULT 'warning', -- info, warning, error
  
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES public.profiles(id),
  resolution_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT valid_conflict_type CHECK (conflict_type IN ('overlapping_shifts', 'insufficient_break', 'location_conflict')),
  CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_shift_conflicts_assignment ON public.shift_conflicts(assignment_id_1, assignment_id_2);
CREATE INDEX IF NOT EXISTS idx_shift_conflicts_company ON public.shift_conflicts(company_id);
CREATE INDEX IF NOT EXISTS idx_shift_conflicts_resolved ON public.shift_conflicts(is_resolved);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.shift_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_conflicts ENABLE ROW LEVEL SECURITY;

-- shift_types: Read by all, Write by admin
CREATE POLICY "shift_types_select"
  ON public.shift_types FOR SELECT
  USING (company_id = public.auth_current_company_id());

CREATE POLICY "shift_types_insert"
  ON public.shift_types FOR INSERT
  WITH CHECK (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('settings.write')
  );

-- shift_assignments: Employee sees own, Manager sees team, HR sees all
CREATE POLICY "shift_assignments_select"
  ON public.shift_assignments FOR SELECT
  USING (
    company_id = public.auth_current_company_id()
    AND (
      -- Own assignments
      employee_id IN (SELECT id FROM public.employee_details WHERE user_id = auth.uid())
      -- Manager: team
      OR employee_id IN (
        SELECT managed_employee_id FROM public.manager_assignments
        WHERE manager_id IN (SELECT id FROM public.employee_details WHERE user_id = auth.uid())
      )
      -- HR/Admin
      OR public.auth_has_permission('settings.read')
    )
  );

CREATE POLICY "shift_assignments_insert"
  ON public.shift_assignments FOR INSERT
  WITH CHECK (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('settings.write')
  );

CREATE POLICY "shift_assignments_update"
  ON public.shift_assignments FOR UPDATE
  USING (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('settings.write')
  );

-- shift_swaps: Employee sees own, HR manages
CREATE POLICY "shift_swaps_select"
  ON public.shift_swaps FOR SELECT
  USING (
    company_id = public.auth_current_company_id()
    AND (
      -- Own swaps
      original_assignment_id IN (
        SELECT id FROM public.shift_assignments 
        WHERE employee_id IN (SELECT id FROM public.employee_details WHERE user_id = auth.uid())
      )
      OR requested_employee_id IN (SELECT id FROM public.employee_details WHERE user_id = auth.uid())
      -- HR
      OR public.auth_has_permission('settings.read')
    )
  );

CREATE POLICY "shift_swaps_insert"
  ON public.shift_swaps FOR INSERT
  WITH CHECK (
    company_id = public.auth_current_company_id()
  );

-- shift_conflicts: HR/Admin only
CREATE POLICY "shift_conflicts_select"
  ON public.shift_conflicts FOR SELECT
  USING (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('settings.read')
  );

CREATE POLICY "shift_conflicts_insert"
  ON public.shift_conflicts FOR INSERT
  WITH CHECK (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('settings.write')
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check for overlapping shifts on same day
CREATE OR REPLACE FUNCTION public.check_shift_conflict(
  p_employee_id UUID,
  p_assigned_date DATE,
  p_exclude_assignment_id UUID DEFAULT NULL
)
RETURNS TABLE (
  has_conflict BOOLEAN,
  conflict_count INT,
  conflict_details JSON
) AS $$
BEGIN
  RETURN QUERY
  WITH existing_shifts AS (
    SELECT sa.id, st.start_time, st.end_time, st.name
    FROM public.shift_assignments sa
    JOIN public.shift_types st ON sa.shift_type_id = st.id
    WHERE sa.employee_id = p_employee_id
      AND sa.assigned_date = p_assigned_date
      AND sa.status IN ('confirmed', 'planned')
      AND (p_exclude_assignment_id IS NULL OR sa.id != p_exclude_assignment_id)
  )
  SELECT 
    COUNT(*) > 0,
    COUNT(*)::INT,
    json_agg(json_build_object('shift_name', name, 'start', start_time, 'end', end_time))
  FROM existing_shifts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get shifts for employee during date range
CREATE OR REPLACE FUNCTION public.get_employee_shifts(
  p_employee_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  assignment_id UUID,
  shift_name VARCHAR,
  assigned_date DATE,
  start_time TIME,
  end_time TIME,
  status shift_status
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sa.id,
    st.name,
    sa.assigned_date,
    st.start_time,
    st.end_time,
    sa.status
  FROM public.shift_assignments sa
  JOIN public.shift_types st ON sa.shift_type_id = st.id
  WHERE sa.employee_id = p_employee_id
    AND sa.assigned_date >= p_start_date
    AND sa.assigned_date <= p_end_date
  ORDER BY sa.assigned_date, st.start_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all assignments for date (for calendar view)
CREATE OR REPLACE FUNCTION public.get_shift_assignments_by_date(
  p_company_id UUID,
  p_date DATE
)
RETURNS TABLE (
  assignment_id UUID,
  employee_id UUID,
  employee_name VARCHAR,
  shift_name VARCHAR,
  start_time TIME,
  end_time TIME,
  status shift_status
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sa.id,
    sa.employee_id,
    (ed.first_name || ' ' || ed.last_name)::VARCHAR,
    st.name,
    st.start_time,
    st.end_time,
    sa.status
  FROM public.shift_assignments sa
  JOIN public.shift_types st ON sa.shift_type_id = st.id
  JOIN public.employee_details ed ON sa.employee_id = ed.id
  WHERE sa.company_id = p_company_id
    AND sa.assigned_date = p_date
    AND sa.status != 'cancelled'
  ORDER BY st.start_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SEED DATA – Schichttypen
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM public.companies LIMIT 1;
  
  IF v_company_id IS NOT NULL THEN
    INSERT INTO public.shift_types (company_id, name, description, start_time, end_time, break_duration_minutes, shift_type, is_paid, requires_manager_approval, max_employees_per_shift, is_active)
    VALUES
      (v_company_id, 'Frühdienst', 'Schicht 06:00 - 14:00', '06:00', '14:00', 30, 'morning', TRUE, FALSE, NULL, TRUE),
      (v_company_id, 'Spätdienst', 'Schicht 14:00 - 22:00', '14:00', '22:00', 30, 'afternoon', TRUE, FALSE, NULL, TRUE),
      (v_company_id, 'Nachtdienst', 'Schicht 22:00 - 06:00', '22:00', '06:00', 45, 'night', TRUE, FALSE, NULL, TRUE),
      (v_company_id, 'Gleitende Schicht', 'Flexible Zeiten', '06:00', '18:00', 30, 'flexible', TRUE, TRUE, NULL, TRUE),
      (v_company_id, 'Bereitschaftsdienst', 'On-Call Dienste', '00:00', '23:59', 0, 'on_call', FALSE, TRUE, NULL, TRUE)
    ON CONFLICT (company_id, name) DO NOTHING;
    
    RAISE NOTICE 'Shift types seeded';
  END IF;
END $$;

-- ============================================================================
-- DONE – Phase 10 Shift Planning
-- ============================================================================

SELECT 'Phase 10: Shift Planning tables created with assignments and conflict detection' as status;
