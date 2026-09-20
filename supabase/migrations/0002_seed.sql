-- Phase 2: Seed – Standard-Rollen, Permissions, Zuordnungen
-- 
-- Basierend auf docs/permissions.md, Abschnitt 8.
-- Diese Seed wird einmalig bei der initialen Migration ausgeführt.

-- ============================================================================
-- 1. PERMISSIONS (Master-Liste aus permissions.md, Abschnitt 3)
-- ============================================================================

INSERT INTO public.permissions (key, description) VALUES
('employees.read', 'Mitarbeiter anzeigen'),
('employees.create', 'Mitarbeiter erstellen'),
('employees.update', 'Mitarbeiter bearbeiten'),
('employees.delete', 'Mitarbeiter löschen'),

('time.read', 'Zeiterfassung anzeigen'),
('time.create', 'Zeiterfassung erstellen'),
('time.update', 'Zeiterfassung bearbeiten'),
('time.approve', 'Zeiterfassung genehmigen'),

('leave.read', 'Urlaub anzeigen'),
('leave.request', 'Urlaubsantrag stellen'),
('leave.approve', 'Urlaubsantrag genehmigen'),
('leave.reject', 'Urlaubsantrag ablehnen'),

('documents.read', 'Dokumente anzeigen'),
('documents.upload', 'Dokumente hochladen'),
('documents.delete', 'Dokumente löschen'),

('payroll.read', 'Abrechnung anzeigen'),
('payroll.create', 'Abrechnung erstellen'),
('payroll.update', 'Abrechnung bearbeiten'),
('payroll.approve', 'Abrechnung genehmigen'),

('reports.read', 'Reports anzeigen'),

('settings.read', 'Einstellungen anzeigen'),
('settings.write', 'Einstellungen ändern'),

('users.manage', 'Benutzer verwalten'),
('roles.manage', 'Rollen verwalten'),
('permissions.manage', 'Permissions verwalten')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. SYSTEM-ROLLEN (company_id = NULL, is_system_role = true)
-- ============================================================================

-- Für jede System-Rolle wird eine globale Rolle angelegt.
-- Im Produktivbetrieb werden diese nur einmal gesät und nicht gelöscht.

INSERT INTO public.roles (company_id, name, is_system_role) VALUES
(NULL, 'super_admin', TRUE),
(NULL, 'company_admin', TRUE),
(NULL, 'hr_admin', TRUE),
(NULL, 'manager', TRUE),
(NULL, 'employee', TRUE)
ON CONFLICT (company_id, name) DO NOTHING;

-- ============================================================================
-- 3. ROLE_PERMISSIONS ZUORDNUNGEN (aus permissions.md, Abschnitt 8)
-- ============================================================================

-- Hilfsfunktion, um die Permission ID zu holen
WITH perm_ids AS (
  SELECT id, key FROM public.permissions
),
role_ids AS (
  SELECT id, name FROM public.roles WHERE is_system_role = true
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT
  (SELECT id FROM role_ids WHERE name = 'super_admin'),
  (SELECT id FROM perm_ids WHERE key = 'users.manage')
UNION ALL
-- SUPER_ADMIN: globale Admin-Rechte (wird selektiv über Support-Access gewährt)
-- Im Kern hat SUPER_ADMIN nur Zugriff auf companies-Tabelle + Support-Access-Verwaltung
-- Weitere Permissions für Firmendaten werden über zeitlich begrenzte Support-Access granted

-- COMPANY_ADMIN: Vollzugriff auf eigene Firma
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'employees.read')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'employees.create')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'employees.update')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'employees.delete')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'time.read')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'time.create')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'time.update')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'time.approve')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'leave.read')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'leave.approve')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'leave.reject')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'documents.read')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'documents.upload')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'documents.delete')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'payroll.read')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'payroll.create')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'payroll.update')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'payroll.approve')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'reports.read')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'settings.read')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'settings.write')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'users.manage')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'roles.manage')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'company_admin'),
  (SELECT id FROM perm_ids WHERE key = 'permissions.manage')

-- HR_ADMIN: HR-operative (ohne Firmen-Admin, ohne Payroll-Approve)
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'hr_admin'),
  (SELECT id FROM perm_ids WHERE key = 'employees.read')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'hr_admin'),
  (SELECT id FROM perm_ids WHERE key = 'employees.create')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'hr_admin'),
  (SELECT id FROM perm_ids WHERE key = 'employees.update')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'hr_admin'),
  (SELECT id FROM perm_ids WHERE key = 'time.read')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'hr_admin'),
  (SELECT id FROM perm_ids WHERE key = 'time.create')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'hr_admin'),
  (SELECT id FROM perm_ids WHERE key = 'time.update')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'hr_admin'),
  (SELECT id FROM perm_ids WHERE key = 'time.approve')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'hr_admin'),
  (SELECT id FROM perm_ids WHERE key = 'leave.read')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'hr_admin'),
  (SELECT id FROM perm_ids WHERE key = 'leave.approve')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'hr_admin'),
  (SELECT id FROM perm_ids WHERE key = 'leave.reject')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'hr_admin'),
  (SELECT id FROM perm_ids WHERE key = 'documents.read')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'hr_admin'),
  (SELECT id FROM perm_ids WHERE key = 'documents.upload')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'hr_admin'),
  (SELECT id FROM perm_ids WHERE key = 'documents.delete')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'hr_admin'),
  (SELECT id FROM perm_ids WHERE key = 'payroll.read')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'hr_admin'),
  (SELECT id FROM perm_ids WHERE key = 'payroll.create')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'hr_admin'),
  (SELECT id FROM perm_ids WHERE key = 'payroll.update')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'hr_admin'),
  (SELECT id FROM perm_ids WHERE key = 'reports.read')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'hr_admin'),
  (SELECT id FROM perm_ids WHERE key = 'settings.read')

-- MANAGER: Team-eingeschränkt (nur zugewiesene Mitarbeiter via manager_assignments)
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'manager'),
  (SELECT id FROM perm_ids WHERE key = 'employees.read')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'manager'),
  (SELECT id FROM perm_ids WHERE key = 'time.read')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'manager'),
  (SELECT id FROM perm_ids WHERE key = 'time.create')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'manager'),
  (SELECT id FROM perm_ids WHERE key = 'time.approve')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'manager'),
  (SELECT id FROM perm_ids WHERE key = 'leave.read')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'manager'),
  (SELECT id FROM perm_ids WHERE key = 'leave.request')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'manager'),
  (SELECT id FROM perm_ids WHERE key = 'leave.approve')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'manager'),
  (SELECT id FROM perm_ids WHERE key = 'leave.reject')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'manager'),
  (SELECT id FROM perm_ids WHERE key = 'documents.read')

-- EMPLOYEE: Minimal (nur eigene Daten)
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'employee'),
  (SELECT id FROM perm_ids WHERE key = 'time.read')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'employee'),
  (SELECT id FROM perm_ids WHERE key = 'time.create')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'employee'),
  (SELECT id FROM perm_ids WHERE key = 'leave.read')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'employee'),
  (SELECT id FROM perm_ids WHERE key = 'leave.request')
UNION ALL
SELECT
  (SELECT id FROM role_ids WHERE name = 'employee'),
  (SELECT id FROM perm_ids WHERE key = 'documents.read')

ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================================
-- DONE – Phase 2 Seed
-- ============================================================================

SELECT 'Phase 2: 0002_seed.sql — Rollen, Permissions, Zuordnungen gesät' as status;
