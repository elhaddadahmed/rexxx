-- Phase 11: Dokumentverwaltung (Document Management)
--
-- Unterstützt:
-- - Private Dokumente (Arbeitsvertrag, Gehaltsabrechnung, Bescheinigungen)
-- - Supabase Storage (tenant-isoliert)
-- - Signierte URLs (zeitlich limitiert, privater Zugriff)
-- - Dateivalidierung (Typ, Größe)
-- - Audit-Trail (Upload, Download, Delete)
-- - Mitarbeiter-Dokumente + Admin-Verwaltung

CREATE TYPE document_type AS ENUM (
  'employment_contract',
  'salary_statement',
  'certificate',
  'employee_document',
  'company_document',
  'other'
);

CREATE TYPE document_status AS ENUM (
  'pending',      -- Hochgeladen, wird verarbeitet
  'approved',     -- HR genehmigt
  'archived',     -- Archiviert
  'deleted'       -- Gelöscht (soft delete)
);

-- ============================================================================
-- 1. DOCUMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Uploader
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Document metadata
  filename VARCHAR(255) NOT NULL,
  file_size_bytes INT NOT NULL, -- In bytes
  file_type VARCHAR(50) NOT NULL, -- e.g., application/pdf, image/png
  mime_type VARCHAR(100) NOT NULL, -- Full MIME type
  
  document_type document_type NOT NULL,
  status document_status NOT NULL DEFAULT 'pending',
  
  -- Storage reference
  storage_path VARCHAR(500) NOT NULL, -- Path in Supabase Storage bucket
  storage_bucket VARCHAR(100) NOT NULL DEFAULT 'hr-documents',
  
  -- Associated data
  employee_id UUID REFERENCES public.employee_details(id) ON DELETE SET NULL,
  description TEXT,
  
  -- Validity period (for certificates, contracts)
  valid_from DATE,
  valid_until DATE,
  
  -- Access control
  is_public BOOLEAN DEFAULT FALSE, -- Public or private
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  -- Soft delete
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT valid_file_size CHECK (file_size_bytes > 0 AND file_size_bytes <= 52428800), -- Max 50MB
  CONSTRAINT valid_validity_period CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from),
  CONSTRAINT valid_approval CHECK ((status = 'approved' AND approved_by IS NOT NULL) OR (status != 'approved'))
);

CREATE INDEX IF NOT EXISTS idx_documents_company ON public.documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_employee ON public.documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_storage_path ON public.documents(storage_path);
CREATE INDEX IF NOT EXISTS idx_documents_created ON public.documents(created_at);

-- ============================================================================
-- 2. DOCUMENT ACCESS LOG (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.document_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  
  actor_user_id UUID NOT NULL REFERENCES public.profiles(id),
  action VARCHAR(50) NOT NULL, -- 'uploaded', 'downloaded', 'viewed', 'approved', 'deleted', 'shared'
  
  ip_address INET,
  user_agent TEXT,
  
  metadata JSONB, -- Additional context (file size at time, etc.)
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT valid_action CHECK (action IN ('uploaded', 'downloaded', 'viewed', 'approved', 'deleted', 'shared', 'shared_access_revoked'))
);

CREATE INDEX IF NOT EXISTS idx_document_audit_logs_company ON public.document_audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_document_audit_logs_document ON public.document_audit_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_document_audit_logs_actor ON public.document_audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_document_audit_logs_action ON public.document_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_document_audit_logs_created ON public.document_audit_logs(created_at);

-- ============================================================================
-- 3. DOCUMENT SHARING (Access Control)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.document_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  
  -- Who can access
  shared_with_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Access level
  access_level VARCHAR(50) NOT NULL DEFAULT 'view', -- 'view', 'download', 'edit', 'manage'
  
  -- Sharing metadata
  shared_by UUID NOT NULL REFERENCES public.profiles(id),
  shared_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Expiration
  expires_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT unique_share UNIQUE (document_id, shared_with_user_id),
  CONSTRAINT valid_access_level CHECK (access_level IN ('view', 'download', 'edit', 'manage'))
);

CREATE INDEX IF NOT EXISTS idx_document_shares_document ON public.document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_user ON public.document_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_expires ON public.document_shares(expires_at);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;

-- documents: Employee sees own docs, Manager/HR sees team/all
CREATE POLICY "documents_select"
  ON public.documents FOR SELECT
  USING (
    company_id = public.auth_current_company_id()
    AND deleted_at IS NULL
    AND (
      -- Own documents
      uploaded_by = auth.uid()
      -- Employee sees own documents
      OR employee_id IN (SELECT id FROM public.employee_details WHERE user_id = auth.uid())
      -- Manager sees team documents
      OR employee_id IN (
        SELECT managed_employee_id FROM public.manager_assignments
        WHERE manager_id IN (SELECT id FROM public.employee_details WHERE user_id = auth.uid())
      )
      -- HR/Admin sees all
      OR public.auth_has_permission('documents.read')
    )
  );

CREATE POLICY "documents_insert"
  ON public.documents FOR INSERT
  WITH CHECK (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('documents.upload')
  );

CREATE POLICY "documents_update"
  ON public.documents FOR UPDATE
  USING (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('documents.update')
  );

CREATE POLICY "documents_delete"
  ON public.documents FOR DELETE
  USING (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('documents.delete')
  );

-- document_audit_logs: HR/Admin only (INSERT-only for audit)
CREATE POLICY "document_audit_logs_select"
  ON public.document_audit_logs FOR SELECT
  USING (
    company_id = public.auth_current_company_id()
    AND public.auth_has_permission('documents.read')
  );

CREATE POLICY "document_audit_logs_insert"
  ON public.document_audit_logs FOR INSERT
  WITH CHECK (
    company_id = public.auth_current_company_id()
  );

-- document_shares: User who can manage or HR
CREATE POLICY "document_shares_select"
  ON public.document_shares FOR SELECT
  USING (
    company_id = public.auth_current_company_id()
    AND (
      shared_with_user_id = auth.uid()
      OR document_id IN (SELECT id FROM public.documents WHERE uploaded_by = auth.uid())
      OR public.auth_has_permission('documents.read')
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if user can access document
CREATE OR REPLACE FUNCTION public.can_access_document(
  p_user_id UUID,
  p_document_id UUID,
  p_access_level VARCHAR DEFAULT 'view'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_doc RECORD;
  v_share RECORD;
BEGIN
  -- Get document
  SELECT * INTO v_doc FROM public.documents 
  WHERE id = p_document_id AND deleted_at IS NULL;
  
  IF v_doc IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Document owner can access
  IF v_doc.uploaded_by = p_user_id THEN
    RETURN TRUE;
  END IF;
  
  -- Check if it's employee's own document
  IF v_doc.employee_id IN (SELECT id FROM public.employee_details WHERE user_id = p_user_id) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if explicitly shared
  SELECT * INTO v_share FROM public.document_shares
  WHERE document_id = p_document_id
    AND shared_with_user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > now());
  
  IF v_share IS NOT NULL THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get documents for employee
CREATE OR REPLACE FUNCTION public.get_employee_documents(
  p_employee_id UUID
)
RETURNS TABLE (
  document_id UUID,
  filename VARCHAR,
  document_type document_type,
  uploaded_at TIMESTAMP WITH TIME ZONE,
  status document_status
) AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.filename, d.document_type, d.uploaded_at, d.status
  FROM public.documents d
  WHERE d.employee_id = p_employee_id
    AND d.deleted_at IS NULL
    AND d.status != 'deleted'
  ORDER BY d.uploaded_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get accessible documents for user
CREATE OR REPLACE FUNCTION public.get_accessible_documents(
  p_user_id UUID
)
RETURNS TABLE (
  document_id UUID,
  filename VARCHAR,
  document_type document_type,
  employee_name VARCHAR,
  uploaded_at TIMESTAMP WITH TIME ZONE,
  status document_status
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.filename,
    d.document_type,
    COALESCE(ed.first_name || ' ' || ed.last_name, 'N/A')::VARCHAR,
    d.uploaded_at,
    d.status
  FROM public.documents d
  LEFT JOIN public.employee_details ed ON d.employee_id = ed.id
  WHERE d.deleted_at IS NULL
    AND d.status != 'deleted'
    AND public.can_access_document(p_user_id, d.id)
  ORDER BY d.uploaded_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DONE – Phase 11 Document Management
-- ============================================================================

SELECT 'Phase 11: Document Management tables created' as status;
