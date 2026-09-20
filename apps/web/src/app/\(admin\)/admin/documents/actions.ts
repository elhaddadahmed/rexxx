'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUserWithPermissions } from '@/lib/auth-server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ============================================================================
// Validation Schemas
// ============================================================================

const UploadDocumentSchema = z.object({
  filename: z.string().max(255),
  file_size_bytes: z.number().min(1).max(52428800), // Max 50MB
  file_type: z.string(),
  mime_type: z.string(),
  document_type: z.enum([
    'employment_contract',
    'salary_statement',
    'certificate',
    'employee_document',
    'company_document',
    'other',
  ]),
  employee_id: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
  valid_from: z.string().date().optional(),
  valid_until: z.string().date().optional(),
  requires_approval: z.boolean().default(false),
});

const DeleteDocumentSchema = z.object({
  document_id: z.string().uuid(),
});

const ApproveDocumentSchema = z.object({
  document_id: z.string().uuid(),
});

// ============================================================================
// Upload Document
// ============================================================================

export async function uploadDocumentAction(data: unknown) {
  try {
    const validated = UploadDocumentSchema.parse(data);
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    if (!profile.permissions?.includes('documents.upload')) {
      return { error: 'Permission denied', code: 'FORBIDDEN' };
    }

    // Allowed MIME types
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedMimeTypes.includes(validated.mime_type)) {
      return { error: 'File type not allowed', code: 'INVALID_FILE_TYPE' };
    }

    if (validated.file_size_bytes > 52428800) {
      return { error: 'File too large (max 50MB)', code: 'FILE_TOO_LARGE' };
    }

    const client = createClient();
    const timestamp = Date.now();
    const storagePath = `companies/${profile.company_id}/documents/${timestamp}-${validated.filename}`;

    // Create document record
    const { data: document, error: createError } = await client
      .from('documents')
      .insert({
        company_id: profile.company_id,
        uploaded_by: user.id,
        filename: validated.filename,
        file_size_bytes: validated.file_size_bytes,
        file_type: validated.file_type,
        mime_type: validated.mime_type,
        document_type: validated.document_type,
        employee_id: validated.employee_id || null,
        description: validated.description || null,
        valid_from: validated.valid_from || null,
        valid_until: validated.valid_until || null,
        requires_approval: validated.requires_approval,
        storage_path: storagePath,
        status: validated.requires_approval ? 'pending' : 'approved',
        approved_by: validated.requires_approval ? null : user.id,
        approved_at: validated.requires_approval ? null : new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.error('Document creation error:', createError);
      return { error: 'Failed to create document', code: 'CREATE_FAILED' };
    }

    // Get signed URL for upload
    const { data: uploadUrl, error: urlError } = await client.storage
      .from('hr-documents')
      .createSignedUploadUrl(storagePath, {
        upsert: false,
      });

    if (urlError || !uploadUrl) {
      console.error('Upload URL error:', urlError);
      return { error: 'Failed to get upload URL', code: 'URL_ERROR' };
    }

    // Audit log
    await client.from('document_audit_logs').insert({
      company_id: profile.company_id,
      document_id: document.id,
      actor_user_id: user.id,
      action: 'uploaded',
      metadata: { filename: validated.filename, file_size: validated.file_size_bytes },
    });

    return {
      data: {
        document_id: document.id,
        upload_url: uploadUrl.signedUrl,
        token: uploadUrl.token,
      },
    };
  } catch (error) {
    console.error('Upload document error:', error);
    return {
      error: error instanceof z.ZodError ? error.errors[0].message : 'Unknown error',
      code: 'VALIDATION_ERROR',
    };
  }
}

// ============================================================================
// Get Download URL
// ============================================================================

export async function getDocumentDownloadUrlAction(documentId: string) {
  try {
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const client = createClient();

    // Get document
    const { data: document, error: getError } = await client
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('company_id', profile.company_id)
      .is('deleted_at', null)
      .single();

    if (getError || !document) {
      return { error: 'Document not found', code: 'NOT_FOUND' };
    }

    // Check access
    const { data: canAccess } = await client.rpc('can_access_document', {
      p_user_id: user.id,
      p_document_id: documentId,
      p_access_level: 'download',
    });

    if (!canAccess) {
      return { error: 'Access denied', code: 'ACCESS_DENIED' };
    }

    // Get signed URL
    const { data: downloadUrl, error: urlError } = await client.storage
      .from('hr-documents')
      .createSignedUrl(document.storage_path, 86400);

    if (urlError || !downloadUrl) {
      return { error: 'Failed to get download URL', code: 'URL_ERROR' };
    }

    // Log download
    await client.from('document_audit_logs').insert({
      company_id: profile.company_id,
      document_id: documentId,
      actor_user_id: user.id,
      action: 'downloaded',
    });

    return { data: { download_url: downloadUrl.signedUrl } };
  } catch (error) {
    console.error('Get download URL error:', error);
    return { error: 'Unknown error', code: 'UNKNOWN' };
  }
}

// ============================================================================
// Delete Document
// ============================================================================

export async function deleteDocumentAction(data: unknown) {
  try {
    const validated = DeleteDocumentSchema.parse(data);
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    if (!profile.permissions?.includes('documents.delete')) {
      return { error: 'Permission denied', code: 'FORBIDDEN' };
    }

    const client = createClient();

    // Get document
    const { data: document, error: getError } = await client
      .from('documents')
      .select('*')
      .eq('id', validated.document_id)
      .eq('company_id', profile.company_id)
      .single();

    if (getError || !document) {
      return { error: 'Document not found', code: 'NOT_FOUND' };
    }

    // Soft delete
    const { error: deleteError } = await client
      .from('documents')
      .update({
        deleted_at: new Date().toISOString(),
        status: 'deleted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', validated.document_id);

    if (deleteError) {
      return { error: 'Failed to delete document', code: 'DELETE_FAILED' };
    }

    // Audit log
    await client.from('document_audit_logs').insert({
      company_id: profile.company_id,
      document_id: validated.document_id,
      actor_user_id: user.id,
      action: 'deleted',
    });

    revalidatePath('/documents');
    return { data: { success: true } };
  } catch (error) {
    console.error('Delete document error:', error);
    return {
      error: error instanceof z.ZodError ? error.errors[0].message : 'Unknown error',
      code: 'VALIDATION_ERROR',
    };
  }
}

// ============================================================================
// Approve Document
// ============================================================================

export async function approveDocumentAction(data: unknown) {
  try {
    const validated = ApproveDocumentSchema.parse(data);
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    if (!profile.permissions?.includes('documents.update')) {
      return { error: 'Permission denied', code: 'FORBIDDEN' };
    }

    const client = createClient();

    // Update document
    const { error: updateError } = await client
      .from('documents')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', validated.document_id)
      .eq('status', 'pending');

    if (updateError) {
      return { error: 'Failed to approve document', code: 'APPROVAL_FAILED' };
    }

    // Audit log
    await client.from('document_audit_logs').insert({
      company_id: profile.company_id,
      document_id: validated.document_id,
      actor_user_id: user.id,
      action: 'approved',
    });

    revalidatePath('/documents');
    return { data: { success: true } };
  } catch (error) {
    console.error('Approve document error:', error);
    return {
      error: error instanceof z.ZodError ? error.errors[0].message : 'Unknown error',
      code: 'VALIDATION_ERROR',
    };
  }
}

// ============================================================================
// Get Documents
// ============================================================================

export async function getDocumentsAction(employeeId?: string) {
  try {
    const { user, profile } = await getCurrentUserWithPermissions();

    if (!user || !profile) {
      return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const client = createClient();

    if (employeeId) {
      // Get documents for specific employee
      if (!profile.permissions?.includes('documents.read')) {
        return { error: 'Permission denied', code: 'FORBIDDEN' };
      }

      const { data: documents, error } = await client.rpc('get_employee_documents', {
        p_employee_id: employeeId,
      });

      if (error) {
        return { error: 'Failed to get documents', code: 'QUERY_FAILED' };
      }

      return { data: documents || [] };
    } else {
      // Get accessible documents for user
      const { data: documents, error } = await client.rpc('get_accessible_documents', {
        p_user_id: user.id,
      });

      if (error) {
        return { error: 'Failed to get documents', code: 'QUERY_FAILED' };
      }

      return { data: documents || [] };
    }
  } catch (error) {
    console.error('Get documents error:', error);
    return { error: 'Unknown error', code: 'UNKNOWN' };
  }
}
