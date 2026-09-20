-- Phase 3: Seed – Test-Daten für manuelles Testen
--
-- Diese Migration erstellt Test-Companies und Test-User.
-- ACHTUNG: Nur für Entwicklung/Staging verwenden, nicht in Production!
--
-- Nach dieser Migration kann mit folgende Credentials getestet werden:
-- - super_admin@test.local / testpass123 (nur lokal)
-- - company_admin@test.local / testpass123
-- - employee@test.local / testpass123

-- ============================================================================
-- TEST-UNTERNEHMEN
-- ============================================================================

-- Company 1: Testfirma GmbH
INSERT INTO public.companies (
  id,
  name,
  slug,
  status,
  plan,
  country,
  federal_state
) VALUES (
  '10000000-0000-0000-0000-000000000001',
  'Testfirma GmbH',
  'testfirma',
  'active',
  'pro',
  'DE',
  'Bayern'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- TEST-USER (für manuelles Testen ohne echte Supabase Auth UI)
--
-- WICHTIG: Diese User müssen manuell über Supabase Dashboard angelegt werden:
-- 1. Gehe zu Supabase Dashboard → Authentication → Users
-- 2. Klicke "Add user" (oder verwende Supabase CLI: supabase auth --local set-jwt-expiry 3600)
-- 3. E-Mail: employee@test.local
--    Passwort: testpass123
-- 4. Wiederhole für company_admin@test.local, super_admin@test.local
--
-- Oder lokal via curl:
-- curl -X POST http://localhost:54321/auth/v1/signup \
--   -H "apikey: <anon-key>" \
--   -H "Content-Type: application/json" \
--   -d '{"email":"employee@test.local","password":"testpass123"}'

-- Diese IDs müssen auf die echten auth.users IDs gesetzt werden!
-- Platzhalter-UUIDs:
-- Employee: 20000000-0000-0000-0000-000000000001
-- Company Admin: 30000000-0000-0000-0000-000000000001
-- Super Admin: 40000000-0000-0000-0000-000000000001

-- Wird über auth-webhook gefüllt, aber wir können manuell seed-ready machen:

-- Employee Profile (wird vom auth-webhook erstellt, aber hier dokumentiert)
-- INSERT INTO public.profiles (id, email, role, status, company_id, first_name, last_name) VALUES
-- ('20000000-0000-0000-0000-000000000001', 'employee@test.local', 'employee', 'active', '10000000-0000-0000-0000-000000000001', 'Max', 'Mustermann')
-- ON CONFLICT (id) DO NOTHING;

-- Company Admin Profile
-- INSERT INTO public.profiles (id, email, role, status, company_id, first_name, last_name) VALUES
-- ('30000000-0000-0000-0000-000000000001', 'company_admin@test.local', 'company_admin', 'active', '10000000-0000-0000-0000-000000000001', 'Anna', 'Admin')
-- ON CONFLICT (id) DO NOTHING;

-- Super Admin Profile
-- INSERT INTO public.profiles (id, email, role, status, company_id, first_name, last_name) VALUES
-- ('40000000-0000-0000-0000-000000000001', 'super_admin@test.local', 'super_admin', 'active', NULL, 'Super', 'Admin')
-- ON CONFLICT (id) DO NOTHING;

-- Alternativ: Lokal via SQL Editor im Supabase Dashboard, auth-webhook konfigurieren:
-- 1. Dashboard → SQL Editor
-- 2. Neue Query
-- 3. INSERT-Statements wie oben
-- 4. Credentials notieren

-- ============================================================================
-- TEST-DEPARTMENTS
-- ============================================================================

INSERT INTO public.departments (
  id,
  company_id,
  name,
  parent_department_id
) VALUES (
  '50000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Geschäftsführung',
  NULL
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.departments (
  id,
  company_id,
  name,
  parent_department_id
) VALUES (
  '50000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'IT',
  '50000000-0000-0000-0000-000000000001'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- AUDIT LOG: Test-Daten angelegt
-- ============================================================================

INSERT INTO public.audit_logs (
  company_id,
  actor_user_id,
  action,
  entity_type,
  entity_id,
  metadata,
  created_at
) VALUES (
  '10000000-0000-0000-0000-000000000001',
  NULL,
  'test_data_seed',
  'system',
  'seed-phase-3',
  '{"message": "Test data for Phase 3 manual testing"}',
  now()
);

-- ============================================================================
-- SETUP-DOKUMENTATION
-- ============================================================================

SELECT 'Phase 3: Test-Seed abgeschlossen. Weitere Schritte:' as step;
SELECT '1. Auth-Webhook im Supabase Dashboard einrichten (siehe Edge Function auth-webhook)' as step;
SELECT '2. Test-User via Supabase Dashboard erstellen oder supabase auth CLI' as step;
SELECT '3. Login mit test@test.local oder employee@test.local versuchen' as step;
SELECT '4. RLS-Policies werden auth.uid() automatisch prüfen' as step;
