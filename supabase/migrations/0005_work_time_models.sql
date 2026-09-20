-- Phase 6: Work Time Models & Rules
--
-- Konfigurierbare Arbeitszeitmodelle für Unternehmen
-- Unterstützt: Vollzeit, Teilzeit, Gleitzeit, Schicht
-- Historisierung: valid_from/valid_to für jede Änderung

CREATE TABLE IF NOT EXISTS public.work_time_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Grundinfos
  name VARCHAR(255) NOT NULL, -- z.B. "Vollzeit", "Teilzeit 50%"
  model_type VARCHAR(50) NOT NULL CHECK (model_type IN ('full_time', 'part_time', 'flexible', 'shift')),
  description TEXT,
  
  -- Arbeitszeit
  weekly_hours DECIMAL(5, 2) NOT NULL, -- Soll-Wochenstunden
  daily_hours DECIMAL(5, 2) NOT NULL,  -- Durchschn. Tagesstunden
  
  -- Konfiguration
  work_days_per_week INT DEFAULT 5 CHECK (work_days_per_week >= 1 AND work_days_per_week <= 7),
  break_duration INT DEFAULT 30, -- Pause in Minuten (automatisch)
  rounding INT DEFAULT 15, -- Rundung in Minuten (z.B. 15, 30)
  
  -- Kernzeit (optional, für flexible Modelle)
  core_hours_start TIME,
  core_hours_end TIME,
  
  -- Nachtarbeit / Sonntag
  allows_night_work BOOLEAN DEFAULT FALSE,
  allows_sunday_work BOOLEAN DEFAULT FALSE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Temporale Daten
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT unique_model_name_per_company UNIQUE (company_id, name)
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_work_time_models_company 
  ON public.work_time_models(company_id);
CREATE INDEX IF NOT EXISTS idx_work_time_models_active 
  ON public.work_time_models(company_id, is_active);

-- RLS
ALTER TABLE public.work_time_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_time_models_select"
  ON public.work_time_models FOR SELECT
  USING (
    company_id = public.auth_current_company_id()
  );

CREATE POLICY "work_time_models_insert"
  ON public.work_time_models FOR INSERT
  WITH CHECK (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('settings.write')
  );

CREATE POLICY "work_time_models_update"
  ON public.work_time_models FOR UPDATE
  USING (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('settings.write')
  )
  WITH CHECK (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('settings.write')
  );

-- ============================================================================
-- Work Time Rules (Work Days + Hours per Day)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.work_time_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_time_model_id UUID NOT NULL REFERENCES public.work_time_models(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Wochentag (0=Sunday, 1=Monday, ..., 6=Saturday)
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  
  -- Arbeitszeit für diesen Tag
  is_working_day BOOLEAN DEFAULT TRUE, -- FALSE = kein Arbeitstag (z.B. Samstag)
  start_time TIME,
  end_time TIME,
  duration_minutes INT, -- Gesamtdauer inkl. Pausen
  break_minutes INT DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT unique_rule_per_model_per_day UNIQUE (work_time_model_id, day_of_week),
  CONSTRAINT valid_times CHECK (start_time IS NULL OR end_time IS NULL OR end_time > start_time)
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_work_time_rules_model 
  ON public.work_time_rules(work_time_model_id);

-- RLS
ALTER TABLE public.work_time_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_time_rules_select"
  ON public.work_time_rules FOR SELECT
  USING (
    company_id = public.auth_current_company_id()
  );

CREATE POLICY "work_time_rules_insert"
  ON public.work_time_rules FOR INSERT
  WITH CHECK (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('settings.write')
  );

CREATE POLICY "work_time_rules_update"
  ON public.work_time_rules FOR UPDATE
  USING (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('settings.write')
  );

-- ============================================================================
-- Work Time Model History (Historisierung bei Änderungen)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.work_time_model_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  work_time_model_id UUID NOT NULL REFERENCES public.work_time_models(id) ON DELETE CASCADE,
  
  -- Snapshot der Konfiguration
  name VARCHAR(255) NOT NULL,
  model_type VARCHAR(50) NOT NULL,
  weekly_hours DECIMAL(5, 2) NOT NULL,
  daily_hours DECIMAL(5, 2) NOT NULL,
  work_days_per_week INT,
  break_duration INT,
  rounding INT,
  
  -- Gültigkeitszeitraum
  valid_from DATE NOT NULL,
  valid_to DATE,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  reason TEXT, -- z.B. "Erhöhung auf Vollzeit"
  
  CONSTRAINT valid_dates CHECK (valid_to IS NULL OR valid_to > valid_from)
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_work_time_model_history_model 
  ON public.work_time_model_history(work_time_model_id);
CREATE INDEX IF NOT EXISTS idx_work_time_model_history_valid 
  ON public.work_time_model_history(valid_from, valid_to);

-- RLS (nur HR-Admin/Company-Admin)
ALTER TABLE public.work_time_model_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_time_model_history_select"
  ON public.work_time_model_history FOR SELECT
  USING (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('settings.read')
  );

-- ============================================================================
-- Helper: Get current work time model for employee on date
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_employee_work_time_model(
  p_employee_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  model_id UUID,
  name VARCHAR,
  model_type VARCHAR,
  weekly_hours DECIMAL,
  daily_hours DECIMAL,
  work_days_per_week INT,
  break_duration INT,
  rounding INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ed.work_time_model_id,
    wtm.name,
    wtm.model_type,
    wtm.weekly_hours,
    wtm.daily_hours,
    wtm.work_days_per_week,
    wtm.break_duration,
    wtm.rounding
  FROM public.employee_details ed
  JOIN public.work_time_models wtm ON ed.work_time_model_id = wtm.id
  WHERE ed.id = p_employee_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Helper: Get work day config for specific date
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_work_day_config(
  p_work_time_model_id UUID,
  p_date DATE
)
RETURNS TABLE (
  day_of_week INT,
  is_working_day BOOLEAN,
  start_time TIME,
  end_time TIME,
  duration_minutes INT,
  break_minutes INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wtr.day_of_week,
    wtr.is_working_day,
    wtr.start_time,
    wtr.end_time,
    wtr.duration_minutes,
    wtr.break_minutes
  FROM public.work_time_rules wtr
  WHERE wtr.work_time_model_id = p_work_time_model_id
    AND wtr.day_of_week = EXTRACT(dow FROM p_date)::INT
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Seed: Default Work Time Models für Testfirma
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_model_id UUID;
BEGIN
  -- Test-Firma finden (aus Phase 3 seed)
  SELECT id INTO v_company_id FROM public.companies WHERE name = 'Testfirma GmbH' LIMIT 1;
  
  IF v_company_id IS NOT NULL THEN
    -- Vollzeit Model
    INSERT INTO public.work_time_models (
      company_id,
      name,
      model_type,
      description,
      weekly_hours,
      daily_hours,
      work_days_per_week,
      break_duration,
      rounding,
      allows_night_work,
      allows_sunday_work
    ) VALUES (
      v_company_id,
      'Vollzeit (40h)',
      'full_time',
      'Standard Vollzeitposition (8h/Tag, Mo-Fr)',
      40.00,
      8.00,
      5,
      30,
      15,
      FALSE,
      FALSE
    ) RETURNING id INTO v_model_id;
    
    -- Work Time Rules für Vollzeit (Mo-Fr: 8:00-17:00, Sa-Su: kein Arbeit)
    INSERT INTO public.work_time_rules (work_time_model_id, company_id, day_of_week, is_working_day, start_time, end_time, duration_minutes, break_minutes) VALUES
      (v_model_id, v_company_id, 1, TRUE, '08:00:00', '17:00:00', 480, 30),  -- Montag
      (v_model_id, v_company_id, 2, TRUE, '08:00:00', '17:00:00', 480, 30),  -- Dienstag
      (v_model_id, v_company_id, 3, TRUE, '08:00:00', '17:00:00', 480, 30),  -- Mittwoch
      (v_model_id, v_company_id, 4, TRUE, '08:00:00', '17:00:00', 480, 30),  -- Donnerstag
      (v_model_id, v_company_id, 5, TRUE, '08:00:00', '17:00:00', 480, 30),  -- Freitag
      (v_model_id, v_company_id, 6, FALSE, NULL, NULL, 0, 0),                -- Samstag
      (v_model_id, v_company_id, 0, FALSE, NULL, NULL, 0, 0);                -- Sonntag
    
    -- Teilzeit 50% Model
    INSERT INTO public.work_time_models (
      company_id,
      name,
      model_type,
      description,
      weekly_hours,
      daily_hours,
      work_days_per_week,
      break_duration,
      rounding,
      allows_night_work,
      allows_sunday_work
    ) VALUES (
      v_company_id,
      'Teilzeit 50% (20h)',
      'part_time',
      'Teilzeitposition (4h/Tag, Mo-Fr)',
      20.00,
      4.00,
      5,
      15,
      15,
      FALSE,
      FALSE
    ) RETURNING id INTO v_model_id;
    
    -- Work Time Rules für Teilzeit (Mo-Fr: 08:00-12:00)
    INSERT INTO public.work_time_rules (work_time_model_id, company_id, day_of_week, is_working_day, start_time, end_time, duration_minutes, break_minutes) VALUES
      (v_model_id, v_company_id, 1, TRUE, '08:00:00', '12:00:00', 240, 15),   -- Montag
      (v_model_id, v_company_id, 2, TRUE, '08:00:00', '12:00:00', 240, 15),   -- Dienstag
      (v_model_id, v_company_id, 3, TRUE, '08:00:00', '12:00:00', 240, 15),   -- Mittwoch
      (v_model_id, v_company_id, 4, TRUE, '08:00:00', '12:00:00', 240, 15),   -- Donnerstag
      (v_model_id, v_company_id, 5, TRUE, '08:00:00', '12:00:00', 240, 15),   -- Freitag
      (v_model_id, v_company_id, 6, FALSE, NULL, NULL, 0, 0),                 -- Samstag
      (v_model_id, v_company_id, 0, FALSE, NULL, NULL, 0, 0);                 -- Sonntag
  END IF;
END $$;

-- ============================================================================
-- DONE – Phase 6 Work Time Models
-- ============================================================================

SELECT 'Phase 6: Work Time Models table created' as status;
