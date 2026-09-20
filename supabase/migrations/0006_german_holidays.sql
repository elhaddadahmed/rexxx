-- Phase 7: Deutsche Feiertage (German Public Holidays)
--
-- Unterstützt:
-- - Bundesweit gültige Feiertage (alle 16 Bundesländer)
-- - Bundesland-spezifische Feiertage
-- - Regionale Besonderheiten (z.B. Fronleichnam nur katholische Bundesländer)

CREATE TABLE IF NOT EXISTS public.german_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country VARCHAR(2) NOT NULL DEFAULT 'DE',
  federal_state VARCHAR(50) NOT NULL, -- z.B. 'Bayern', 'Berlin' oder 'DE' für bundesweit
  year INT NOT NULL,
  date DATE NOT NULL,
  holiday_name VARCHAR(255) NOT NULL, -- z.B. 'Neujahrstag', 'Fronleichnam'
  is_national_holiday BOOLEAN DEFAULT FALSE, -- TRUE wenn für alle Bundesländer
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT unique_holiday UNIQUE (federal_state, year, date),
  CONSTRAINT valid_year CHECK (year >= 2000 AND year <= 2100),
  CONSTRAINT valid_date CHECK (date_trunc('year', date)::date = make_date(year, 1, 1))
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_german_holidays_date 
  ON public.german_holidays(date);
CREATE INDEX IF NOT EXISTS idx_german_holidays_federal_state 
  ON public.german_holidays(federal_state, year);
CREATE INDEX IF NOT EXISTS idx_german_holidays_national 
  ON public.german_holidays(is_national_holiday, year);

-- RLS (Read-only for everyone, Insert/Update/Delete only for admin)
ALTER TABLE public.german_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "german_holidays_select"
  ON public.german_holidays FOR SELECT
  USING (true); -- Öffentlich lesbar

CREATE POLICY "german_holidays_insert"
  ON public.german_holidays FOR INSERT
  WITH CHECK (
    public.auth_has_permission('settings.write')
  );

-- ============================================================================
-- SEED DATA: Deutsche Feiertage 2024-2026
--
-- Bundesländer:
-- - DE (bundesweit / national)
-- - Baden-Württemberg, Bayern, Berlin, Brandenburg, Bremen, Hamburg, Hessen
-- - Mecklenburg-Vorpommern, Niedersachsen, Nordrhein-Westfalen, Rheinland-Pfalz
-- - Saarland, Sachsen, Sachsen-Anhalt, Schleswig-Holstein, Thüringen
-- ============================================================================

DO $$
DECLARE
  v_year INT;
  v_years INT[] := ARRAY[2024, 2025, 2026];
BEGIN
  FOREACH v_year IN ARRAY v_years LOOP
    
    -- ========================================================================
    -- Bundesweit gültige Feiertage (alle 16 Bundesländer)
    -- ========================================================================
    
    INSERT INTO public.german_holidays (country, federal_state, year, date, holiday_name, is_national_holiday)
    VALUES
      ('DE', 'DE', v_year, make_date(v_year, 1, 1), 'Neujahrstag', TRUE),
      ('DE', 'DE', v_year, make_date(v_year, 5, 1), 'Tag der Arbeit', TRUE),
      ('DE', 'DE', v_year, make_date(v_year, 10, 3), 'Tag der Deutschen Einheit', TRUE),
      ('DE', 'DE', v_year, make_date(v_year, 12, 25), '1. Weihnachtstag', TRUE),
      ('DE', 'DE', v_year, make_date(v_year, 12, 26), '2. Weihnachtstag', TRUE),
      ('DE', 'DE', v_year, make_date(v_year, 12, 31), 'Silvester', TRUE)
    ON CONFLICT (federal_state, year, date) DO NOTHING;
    
    -- Karfreitag (Good Friday) - bundesweit, berechnet aus Ostern
    -- Ostern 2024: 31.03, 2025: 20.04, 2026: 05.04
    INSERT INTO public.german_holidays (country, federal_state, year, date, holiday_name, is_national_holiday)
    SELECT 'DE', 'DE', v_year, 
      CASE v_year
        WHEN 2024 THEN '2024-03-29'::date
        WHEN 2025 THEN '2025-04-18'::date
        WHEN 2026 THEN '2026-04-03'::date
      END::date,
      'Karfreitag', TRUE
    ON CONFLICT (federal_state, year, date) DO NOTHING;
    
    -- Ostermontag (Easter Monday)
    INSERT INTO public.german_holidays (country, federal_state, year, date, holiday_name, is_national_holiday)
    SELECT 'DE', 'DE', v_year,
      CASE v_year
        WHEN 2024 THEN '2024-04-01'::date
        WHEN 2025 THEN '2025-04-21'::date
        WHEN 2026 THEN '2026-04-06'::date
      END::date,
      'Ostermontag', TRUE
    ON CONFLICT (federal_state, year, date) DO NOTHING;
    
    -- Christi Himmelfahrt (39 Tage nach Ostern)
    INSERT INTO public.german_holidays (country, federal_state, year, date, holiday_name, is_national_holiday)
    SELECT 'DE', 'DE', v_year,
      CASE v_year
        WHEN 2024 THEN '2024-05-09'::date
        WHEN 2025 THEN '2025-05-29'::date
        WHEN 2026 THEN '2026-05-14'::date
      END::date,
      'Christi Himmelfahrt', TRUE
    ON CONFLICT (federal_state, year, date) DO NOTHING;
    
    -- Pfingstmontag (50 Tage nach Ostern)
    INSERT INTO public.german_holidays (country, federal_state, year, date, holiday_name, is_national_holiday)
    SELECT 'DE', 'DE', v_year,
      CASE v_year
        WHEN 2024 THEN '2024-05-20'::date
        WHEN 2025 THEN '2025-06-09'::date
        WHEN 2026 THEN '2026-05-25'::date
      END::date,
      'Pfingstmontag', TRUE
    ON CONFLICT (federal_state, year, date) DO NOTHING;
    
    -- ========================================================================
    -- Bundesland-spezifische Feiertage
    -- ========================================================================
    
    -- Fronleichnam (Corpus Christi) - 60 Tage nach Ostern
    -- Gültig in: Baden-Württemberg, Bayern, Hessen, Nordrhein-Westfalen, Rheinland-Pfalz, Saarland
    INSERT INTO public.german_holidays (country, federal_state, year, date, holiday_name, is_national_holiday)
    SELECT 'DE', state, v_year,
      CASE v_year
        WHEN 2024 THEN '2024-05-30'::date
        WHEN 2025 THEN '2025-06-19'::date
        WHEN 2026 THEN '2026-06-04'::date
      END::date,
      'Fronleichnam', FALSE
    FROM (VALUES 
      ('Baden-Württemberg'),
      ('Bayern'),
      ('Hessen'),
      ('Nordrhein-Westfalen'),
      ('Rheinland-Pfalz'),
      ('Saarland')
    ) AS t(state)
    ON CONFLICT (federal_state, year, date) DO NOTHING;
    
    -- Mariä Himmelfahrt (Assumption of Mary) - 15. August
    -- Gültig in: Bayern, Saarland
    INSERT INTO public.german_holidays (country, federal_state, year, date, holiday_name, is_national_holiday)
    SELECT 'DE', state, v_year, make_date(v_year, 8, 15), 'Mariä Himmelfahrt', FALSE
    FROM (VALUES ('Bayern'), ('Saarland')) AS t(state)
    ON CONFLICT (federal_state, year, date) DO NOTHING;
    
    -- Reformationstag (Reformation Day) - 31. Oktober
    -- Gültig in: Brandenburg, Mecklenburg-Vorpommern, Sachsen, Sachsen-Anhalt, Thüringen
    INSERT INTO public.german_holidays (country, federal_state, year, date, holiday_name, is_national_holiday)
    SELECT 'DE', state, v_year, make_date(v_year, 10, 31), 'Reformationstag', FALSE
    FROM (VALUES
      ('Brandenburg'),
      ('Mecklenburg-Vorpommern'),
      ('Sachsen'),
      ('Sachsen-Anhalt'),
      ('Thüringen')
    ) AS t(state)
    ON CONFLICT (federal_state, year, date) DO NOTHING;
    
    -- Allerheiligen (All Saints Day) - 1. November
    -- Gültig in: Baden-Württemberg, Bayern, Nordrhein-Westfalen, Rheinland-Pfalz, Saarland
    INSERT INTO public.german_holidays (country, federal_state, year, date, holiday_name, is_national_holiday)
    SELECT 'DE', state, v_year, make_date(v_year, 11, 1), 'Allerheiligen', FALSE
    FROM (VALUES
      ('Baden-Württemberg'),
      ('Bayern'),
      ('Nordrhein-Westfalen'),
      ('Rheinland-Pfalz'),
      ('Saarland')
    ) AS t(state)
    ON CONFLICT (federal_state, year, date) DO NOTHING;
    
    -- Buß- und Bettag (Penance Day) - Mittwoch vor dem 23. November
    -- Gültig nur in: Sachsen
    -- 2024: 20.11, 2025: 19.11, 2026: 18.11
    INSERT INTO public.german_holidays (country, federal_state, year, date, holiday_name, is_national_holiday)
    SELECT 'DE', 'Sachsen', v_year,
      CASE v_year
        WHEN 2024 THEN '2024-11-20'::date
        WHEN 2025 THEN '2025-11-19'::date
        WHEN 2026 THEN '2026-11-18'::date
      END::date,
      'Buß- und Bettag', FALSE
    ON CONFLICT (federal_state, year, date) DO NOTHING;
    
  END LOOP;
END $$;

-- ============================================================================
-- Helper Function: Check if date is a holiday for federal state
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_german_holiday(
  p_date DATE,
  p_federal_state VARCHAR(50)
)
RETURNS TABLE (
  is_holiday BOOLEAN,
  holiday_name VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE((SELECT true 
      FROM public.german_holidays 
      WHERE date = p_date 
        AND (federal_state = 'DE' OR federal_state = p_federal_state)
      LIMIT 1), false) AS is_holiday,
    (SELECT holiday_name 
      FROM public.german_holidays 
      WHERE date = p_date 
        AND (federal_state = 'DE' OR federal_state = p_federal_state)
      LIMIT 1) AS holiday_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Helper Function: Get all holidays for company's federal state in date range
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_company_holidays(
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  date DATE,
  holiday_name VARCHAR
) AS $$
DECLARE
  v_federal_state VARCHAR(50);
BEGIN
  -- Get company's federal state
  SELECT companies.federal_state INTO v_federal_state
  FROM public.companies
  WHERE id = p_company_id;
  
  -- If no federal state, use 'DE' (national)
  v_federal_state := COALESCE(v_federal_state, 'DE');
  
  RETURN QUERY
  SELECT 
    gh.date,
    gh.holiday_name
  FROM public.german_holidays gh
  WHERE gh.date BETWEEN p_start_date AND p_end_date
    AND (gh.federal_state = 'DE' OR gh.federal_state = v_federal_state)
  ORDER BY gh.date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Helper Function: Get holidays for a specific year and federal state
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_holidays_by_state(
  p_federal_state VARCHAR(50),
  p_year INT
)
RETURNS TABLE (
  date DATE,
  holiday_name VARCHAR,
  is_national BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gh.date,
    gh.holiday_name,
    gh.is_national_holiday
  FROM public.german_holidays gh
  WHERE gh.federal_state IN ('DE', p_federal_state)
    AND gh.year = p_year
  ORDER BY gh.date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DONE – Phase 7 German Holidays
-- ============================================================================

SELECT 'Phase 7: German Holidays table created with full seeding for 2024-2026' as status;
