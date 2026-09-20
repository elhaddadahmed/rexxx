-- Phase 2: Kern-Tabellen, RLS-Policies, Helper-Functions
-- 
-- STRUKTUR:
-- 1. Companies (Tenant-Root)
-- 2. Auth → profiles Extension (1:1 zu auth.users, ohne company_id auf auth.users selbst)
-- 3. Rollen + Permissions System
-- 4. Manager Assignments
-- 5. Employee Details (mit Historisierung Platzhalter)
-- 6. Audit Logs (append-only)
-- 7. Support Access Requests (SUPER_ADMIN Kontrolle)
-- 8. DSGVO: Retention Policies, Data Export Requests
-- 9. RLS-Policies (SELECT/INSERT/UPDATE/DELETE für jede Tabelle)
-- 10. Helper-Functions (auth.current_company_id, auth.has_permission, auth.can_access_employee)

-- ============================================================================
-- 1. COMPANIES – Tenant-Root
-- ============================================================================

CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial')),
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  country TEXT NOT NULL DEFAULT 'DE',
  federal_state TEXT, -- z.B. 'Bayern', 'Berlin' — null für nicht DE oder bundesweit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_companies_slug ON public.companies(slug);
CREATE INDEX idx_companies_status ON public.companies(status);

-- ============================================================================
-- 2. PROFILES – Extension zu auth.users (1:1)
-- ============================================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('super_admin', 'company_admin', 'hr_admin', 'manager', 'employee')),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_status ON public.profiles(status);
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- IMPORTANT: SUPER_ADMIN hat company_id = NULL (kein Company-Scope)
-- Alle anderen haben company_id NOT NULL

-- ============================================================================
-- 3. ROLLEN & PERMISSIONS SYSTEM
-- ============================================================================

CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  -- null = System-Rolle (SUPER_ADMIN etc., can't be deleted)
  name TEXT NOT NULL,
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_roles_name_per_company ON public.roles(company_id, name);
CREATE INDEX idx_roles_is_system ON public.roles(is_system_role);

CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE, -- z.B. 'employees.read', 'time.approve'
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON public.role_permissions(permission_id);

CREATE TABLE public.user_roles (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id, company_id)
);

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_company_id ON public.user_roles(company_id);
CREATE INDEX idx_user_roles_role_id ON public.user_roles(role_id);

-- ============================================================================
-- 4. MANAGER ASSIGNMENTS (Team-Scope für MANAGER-Rolle)
-- ============================================================================

CREATE TABLE public.manager_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (manager_id, employee_id, company_id)
);

CREATE INDEX idx_manager_assignments_manager_id ON public.manager_assignments(manager_id);
CREATE INDEX idx_manager_assignments_employee_id ON public.manager_assignments(employee_id);
CREATE INDEX idx_manager_assignments_company_id ON public.manager_assignments(company_id);

-- ============================================================================
-- 5. DEPARTMENTS (Preview für spätere Phasen, mit company_id)
-- ============================================================================

CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE INDEX idx_departments_company_id ON public.departments(company_id);
CREATE INDEX idx_departments_parent ON public.departments(parent_department_id);

-- ============================================================================
-- 6. EMPLOYEE_DETAILS (+ Historisierung Platzhalter)
-- ============================================================================

CREATE TABLE public.employee_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  employee_number TEXT,
  position_title TEXT,
  employment_type TEXT DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contractor', 'intern')),
  hired_at DATE,
  contract_end_at DATE,
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_employee_details_company_id ON public.employee_details(company_id);
CREATE INDEX idx_employee_details_profile_id ON public.employee_details(profile_id);
CREATE INDEX idx_employee_details_manager_id ON public.employee_details(manager_id);
CREATE INDEX idx_employee_details_department_id ON public.employee_details(department_id);

-- Historisierungs-Platzhalter (werden in späteren Phasen befüllt, wenn wirkliche Änderungen nötig sind)
-- salary_history, employment_contract_history, department_history, etc. — siehe database.md, Abschnitt 3

-- ============================================================================
-- 7. AUDIT LOGS (append-only, write-protected)
-- ============================================================================

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID, -- NULL bei SUPER_ADMIN-Systemaktionen
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- z.B. 'profile.created', 'login.failed'
  entity_type TEXT, -- z.B. 'employee', 'role', 'permission'
  entity_id UUID,
  previous_state JSONB, -- Diff-Struktur
  new_state JSONB,
  metadata JSONB, -- Zusätzliche Kontextinfos
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_company_id ON public.audit_logs(company_id);
CREATE INDEX idx_audit_logs_actor_user_id ON public.audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- ============================================================================
-- 8. SUPPORT_ACCESS_REQUESTS (für zeitlich begrenzte SUPER_ADMIN-Zugriffe)
-- ============================================================================

CREATE TABLE public.support_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- SUPER_ADMIN
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  data_scope TEXT[] NOT NULL, -- z.B. ARRAY['employees', 'time_entries']
  expires_at TIMESTAMPTZ NOT NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Optional: Company-Admin Freigabe
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_support_access_requests_company_id ON public.support_access_requests(company_id);
CREATE INDEX idx_support_access_requests_requested_by ON public.support_access_requests(requested_by);
CREATE INDEX idx_support_access_requests_status ON public.support_access_requests(status);

-- ============================================================================
-- 9. DSGVO: RETENTION_POLICIES & DATA_EXPORT_REQUESTS
-- ============================================================================

CREATE TABLE public.retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE, -- NULL = Platform-Default
  entity_type TEXT NOT NULL, -- z.B. 'time_entries', 'payroll_documents'
  retention_period_months INTEGER NOT NULL,
  legal_basis TEXT, -- z.B. '§147 AO'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_retention_policies_entity ON public.retention_policies(COALESCE(company_id, 'null'::UUID), entity_type);

CREATE TABLE public.retention_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action TEXT NOT NULL CHECK (action IN ('deleted', 'anonymized')),
  retention_policy_id UUID REFERENCES public.retention_policies(id) ON DELETE SET NULL
);

CREATE INDEX idx_retention_executions_entity ON public.retention_executions(entity_type, entity_id);
CREATE INDEX idx_retention_executions_company_id ON public.retention_executions(company_id);

CREATE TABLE public.data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  file_storage_path TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_data_export_requests_requested_by ON public.data_export_requests(requested_by);
CREATE INDEX idx_data_export_requests_company_id ON public.data_export_requests(company_id);

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) – ENABLE & POLICIES
-- ============================================================================

-- Enable RLS auf allen relevanten Tabellen
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 11. HELPER FUNCTIONS (Security Definer)
-- ============================================================================

-- Gibt die company_id des aktuellen Users zurück (null für SUPER_ADMIN)
CREATE OR REPLACE FUNCTION public.auth_current_company_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Gibt die Role des aktuellen Users als Text zurück
CREATE OR REPLACE FUNCTION public.auth_current_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role::TEXT FROM public.profiles WHERE id = auth.uid()
$$;

-- Prüft, ob der aktuelle User eine bestimmte Permission hat
CREATE OR REPLACE FUNCTION public.auth_has_permission(perm_key TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND p.key = perm_key
  )
$$;

-- Prüft, ob der aktuelle User (MANAGER) einen bestimmten Mitarbeiter verwalten darf
-- Oder ob er die generale employees.read Permission hat
CREATE OR REPLACE FUNCTION public.auth_can_access_employee(target_employee_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT
    -- Generische Permission: alle Mitarbeiter der eigenen Firma sehen
    (public.auth_has_permission('employees.read') AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = target_employee_id
        AND p.company_id = public.auth_current_company_id()
    ))
    OR
    -- OR: Eigener Datensatz (Employee sieht sich selbst)
    (target_employee_id = auth.uid())
    OR
    -- OR: Manager mit spezifischer Zuweisung
    EXISTS (
      SELECT 1 FROM public.manager_assignments ma
      WHERE ma.manager_id = auth.uid()
        AND ma.employee_id = target_employee_id
        AND ma.company_id = public.auth_current_company_id()
    )
$$;

-- ============================================================================
-- POLICIES: COMPANIES
-- ============================================================================

-- SUPER_ADMIN darf alle Companies sehen (via Support Access)
-- Company Admin darf nur eigene Company sehen
CREATE POLICY "companies_select"
ON public.companies
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'super_admin'
  )
  OR
  id = public.auth_current_company_id()
);

CREATE POLICY "companies_update"
ON public.companies
FOR UPDATE
USING (
  id = public.auth_current_company_id()
  AND public.auth_has_permission('settings.write')
);

-- SUPER_ADMIN (ohne Company-Scope): insert/delete
CREATE POLICY "companies_insert"
ON public.companies
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'super_admin'
  )
);

-- ============================================================================
-- POLICIES: PROFILES
-- ============================================================================

CREATE POLICY "profiles_select"
ON public.profiles
FOR SELECT
USING (
  company_id = public.auth_current_company_id()
  OR id = auth.uid()
  OR (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    AND public.auth_has_permission('users.manage')
  )
);

CREATE POLICY "profiles_insert"
ON public.profiles
FOR INSERT
WITH CHECK (
  company_id = public.auth_current_company_id()
  AND public.auth_has_permission('users.manage')
);

CREATE POLICY "profiles_update"
ON public.profiles
FOR UPDATE
USING (
  (company_id = public.auth_current_company_id() AND public.auth_has_permission('users.manage'))
  OR id = auth.uid()
);

-- ============================================================================
-- POLICIES: ROLES, PERMISSIONS (nur für Admin-Verwaltung)
-- ============================================================================

CREATE POLICY "roles_select"
ON public.roles
FOR SELECT
USING (
  company_id = public.auth_current_company_id()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
);

CREATE POLICY "roles_insert"
ON public.roles
FOR INSERT
WITH CHECK (
  company_id = public.auth_current_company_id()
  AND public.auth_has_permission('roles.manage')
);

CREATE POLICY "permissions_select"
ON public.permissions
FOR SELECT
USING (true); -- Permissions sind öffentlich lesbar (ohne company-Scope)

-- ============================================================================
-- POLICIES: USER_ROLES & ROLE_PERMISSIONS
-- ============================================================================

CREATE POLICY "user_roles_select"
ON public.user_roles
FOR SELECT
USING (
  company_id = public.auth_current_company_id()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
);

CREATE POLICY "user_roles_insert"
ON public.user_roles
FOR INSERT
WITH CHECK (
  company_id = public.auth_current_company_id()
  AND public.auth_has_permission('users.manage')
);

CREATE POLICY "role_permissions_select"
ON public.role_permissions
FOR SELECT
USING (true); -- Für alle sichtbar (Rollen-Info öffentlich)

-- ============================================================================
-- POLICIES: MANAGER_ASSIGNMENTS
-- ============================================================================

CREATE POLICY "manager_assignments_select"
ON public.manager_assignments
FOR SELECT
USING (
  company_id = public.auth_current_company_id()
  AND (
    public.auth_has_permission('employees.read')
    OR manager_id = auth.uid()
  )
);

CREATE POLICY "manager_assignments_insert"
ON public.manager_assignments
FOR INSERT
WITH CHECK (
  company_id = public.auth_current_company_id()
  AND public.auth_has_permission('users.manage')
);

-- ============================================================================
-- POLICIES: DEPARTMENTS
-- ============================================================================

CREATE POLICY "departments_select"
ON public.departments
FOR SELECT
USING (
  company_id = public.auth_current_company_id()
);

CREATE POLICY "departments_insert"
ON public.departments
FOR INSERT
WITH CHECK (
  company_id = public.auth_current_company_id()
  AND public.auth_has_permission('settings.write')
);

-- ============================================================================
-- POLICIES: EMPLOYEE_DETAILS
-- ============================================================================

CREATE POLICY "employee_details_select"
ON public.employee_details
FOR SELECT
USING (
  company_id = public.auth_current_company_id()
  AND (
    public.auth_has_permission('employees.read')
    OR profile_id = auth.uid()
    OR public.auth_can_access_employee(profile_id)
  )
);

CREATE POLICY "employee_details_insert"
ON public.employee_details
FOR INSERT
WITH CHECK (
  company_id = public.auth_current_company_id()
  AND public.auth_has_permission('employees.create')
);

CREATE POLICY "employee_details_update"
ON public.employee_details
FOR UPDATE
USING (
  company_id = public.auth_current_company_id()
  AND public.auth_has_permission('employees.update')
)
WITH CHECK (
  company_id = public.auth_current_company_id()
);

-- ============================================================================
-- POLICIES: AUDIT_LOGS (append-only, write-protected)
-- ============================================================================

CREATE POLICY "audit_logs_select"
ON public.audit_logs
FOR SELECT
USING (
  (company_id = public.auth_current_company_id() AND public.auth_has_permission('reports.read'))
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
);

CREATE POLICY "audit_logs_insert"
ON public.audit_logs
FOR INSERT
WITH CHECK (true); -- Server-Kontext, nur Edge Functions

-- NO UPDATE/DELETE policy → implizit verboten durch Abwesenheit
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;

-- ============================================================================
-- POLICIES: SUPPORT_ACCESS_REQUESTS
-- ============================================================================

CREATE POLICY "support_access_requests_select"
ON public.support_access_requests
FOR SELECT
USING (
  requested_by = auth.uid()
  OR approved_by = auth.uid()
  OR (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('settings.read')
  )
);

CREATE POLICY "support_access_requests_insert"
ON public.support_access_requests
FOR INSERT
WITH CHECK (
  requested_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'super_admin'
  )
);

-- ============================================================================
-- POLICIES: DATA_EXPORT_REQUESTS
-- ============================================================================

CREATE POLICY "data_export_requests_select"
ON public.data_export_requests
FOR SELECT
USING (
  requested_by = auth.uid()
  OR (company_id = public.auth_current_company_id() AND public.auth_has_permission('employees.read'))
);

CREATE POLICY "data_export_requests_insert"
ON public.data_export_requests
FOR INSERT
WITH CHECK (
  requested_by = auth.uid()
  AND company_id = public.auth_current_company_id()
);

-- ============================================================================
-- DONE – Phase 2 Migration (Teil 1: Tabellen + RLS + Functions)
-- ============================================================================

SELECT 'Phase 2: 0001_init.sql — Kern-Tabellen, RLS, Helper-Functions erstellt' as status;
