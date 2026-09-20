/**
 * Server-side Permission & Authorization Utilities
 * 
 * Für Next.js Server Components + Server Actions.
 * Nutzt Supabase Service Role Key für privilegierte Operationen.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@novaro/shared-types';
import { ROLE, PERMISSIONS } from '@novaro/shared-constants';

// Server-side Client mit Service Role
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

/**
 * Hole User-Profil + Permissions für Authorization Checks
 */
export async function getCurrentUserWithPermissions(userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      `
      id,
      email,
      role,
      company_id,
      status,
      first_name,
      last_name
    `,
    )
    .eq('id', userId)
    .single();

  if (profileError) {
    throw new Error(`Profile nicht gefunden: ${profileError.message}`);
  }

  // Permissions basierend auf Role + Company laden
  const { data: userPermissions, error: permError } = await supabase
    .from('role_permissions')
    .select('permissions(key)')
    .eq('role_id', (await getRoleId(profile.role, profile.company_id)).data?.id);

  if (permError && permError.code !== 'PGRST116') {
    console.error('Permission fetch error:', permError);
  }

  const permissions = userPermissions?.map((rp: any) => rp.permissions?.key).filter(Boolean) || [];

  return {
    user: profile,
    permissions,
  };
}

/**
 * Prüfe, ob User eine bestimmte Permission hat
 */
export async function hasPermission(userId: string, permissionKey: string): Promise<boolean> {
  try {
    const { user, permissions } = await getCurrentUserWithPermissions(userId);

    // SUPER_ADMIN hat immer alle Permissions (wenn Support-Access active)
    if (user.role === ROLE.SUPER_ADMIN) {
      // Prüfe Support-Access Validität
      const { data: supportAccess } = await supabase
        .from('support_access_requests')
        .select('*')
        .eq('requested_by', userId)
        .eq('status', 'approved')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (supportAccess) {
        return true; // SUPER_ADMIN mit aktiven Support-Access darf alles
      }
      return false;
    }

    return permissions.includes(permissionKey);
  } catch (err) {
    console.error('Permission check error:', err);
    return false;
  }
}

/**
 * Prüfe, ob User Zugriff auf eine bestimmte Employee hat
 */
export async function canAccessEmployee(
  userId: string,
  employeeId: string,
  requiredPermission: string,
): Promise<boolean> {
  const { user, permissions } = await getCurrentUserWithPermissions(userId);

  // Permission check
  if (!permissions.includes(requiredPermission)) {
    return false;
  }

  // Company-Admin + HR-Admin können alle Employees ihrer Firma sehen
  if (user.role === ROLE.COMPANY_ADMIN || user.role === ROLE.HR_ADMIN) {
    const { data: employee } = await supabase
      .from('employee_details')
      .select('company_id')
      .eq('profile_id', employeeId)
      .single();

    return employee?.company_id === user.company_id;
  }

  // Manager können nur ihre Team-Mitarbeiter sehen
  if (user.role === ROLE.MANAGER) {
    const { data: assignment } = await supabase
      .from('manager_assignments')
      .select('*')
      .eq('manager_id', userId)
      .eq('employee_id', employeeId)
      .single();

    return !!assignment;
  }

  // Employee kann nur sich selbst sehen
  if (user.role === ROLE.EMPLOYEE) {
    return userId === employeeId;
  }

  return false;
}

/**
 * Hole Role ID für ein Rollenname + Company
 */
export async function getRoleId(roleName: string, companyId: string | null) {
  return supabase
    .from('roles')
    .select('id')
    .eq('name', roleName)
    .eq('company_id', companyId)
    .single();
}

/**
 * Erstelle neuen User mit Profile + Role-Zuweisung
 * Nur für Admins erlaubt
 */
export async function createUserWithRole(
  adminUserId: string,
  email: string,
  roleName: string,
  companyId: string,
  firstName?: string,
  lastName?: string,
) {
  // Permission Check
  const canCreate = await hasPermission(adminUserId, PERMISSIONS.USERS_MANAGE);
  if (!canCreate) {
    throw new Error('Keine Berechtigung zum Erstellen von Benutzern');
  }

  // User via Auth API erstellen (braucht Service Role)
  const { data: newAuth, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: Math.random().toString(36).slice(2, 15), // Temp password
    email_confirm: false,
  });

  if (authError) {
    throw new Error(`Auth-Fehler: ${authError.message}`);
  }

  // Profile erstellen
  const { error: profileError } = await supabase.from('profiles').insert({
    id: newAuth.user!.id,
    email,
    role: roleName,
    company_id: companyId,
    status: 'invited',
    first_name: firstName,
    last_name: lastName,
  });

  if (profileError) {
    // Rollback: Auth-User löschen
    await supabase.auth.admin.deleteUser(newAuth.user!.id);
    throw new Error(`Profile-Fehler: ${profileError.message}`);
  }

  // Audit Log
  await supabase.from('audit_logs').insert({
    company_id: companyId,
    actor_user_id: adminUserId,
    action: 'user_created',
    entity_type: 'user',
    entity_id: newAuth.user!.id,
    metadata: {
      email,
      role: roleName,
    },
  });

  return newAuth.user;
}

/**
 * Update User Role
 */
export async function updateUserRole(
  adminUserId: string,
  targetUserId: string,
  newRole: string,
  companyId: string,
) {
  const canManage = await hasPermission(adminUserId, PERMISSIONS.ROLES_MANAGE);
  if (!canManage) {
    throw new Error('Keine Berechtigung zum Verwalten von Rollen');
  }

  const { data: oldProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', targetUserId)
    .single();

  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', targetUserId);

  if (error) {
    throw new Error(`Role-Update Fehler: ${error.message}`);
  }

  // Audit Log
  await supabase.from('audit_logs').insert({
    company_id: companyId,
    actor_user_id: adminUserId,
    action: 'user_role_changed',
    entity_type: 'user',
    entity_id: targetUserId,
    previous_state: { role: oldProfile?.role },
    new_state: { role: newRole },
  });
}

/**
 * Delete User
 */
export async function deleteUser(
  adminUserId: string,
  targetUserId: string,
  companyId: string,
) {
  const canDelete = await hasPermission(adminUserId, PERMISSIONS.USERS_MANAGE);
  if (!canDelete) {
    throw new Error('Keine Berechtigung zum Löschen von Benutzern');
  }

  // Soft-Delete: Status auf 'deactivated' setzen
  const { error } = await supabase
    .from('profiles')
    .update({ status: 'deactivated' })
    .eq('id', targetUserId);

  if (error) {
    throw new Error(`Löschen Fehler: ${error.message}`);
  }

  // Audit Log
  await supabase.from('audit_logs').insert({
    company_id: companyId,
    actor_user_id: adminUserId,
    action: 'user_deactivated',
    entity_type: 'user',
    entity_id: targetUserId,
  });
}
