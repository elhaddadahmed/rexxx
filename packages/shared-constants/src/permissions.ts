/**
 * Permission-Keys – Single Source of Truth für Web + Mobile.
 * Muss synchron mit `permissions.key` in der Datenbank bleiben (siehe docs/permissions.md,
 * Abschnitt 3).
 *
 * WICHTIG: Wird ausschließlich verwendet, um UI-Elemente ein-/auszublenden (Komfort).
 * Die verbindliche Prüfung läuft immer serverseitig via auth.has_permission() in RLS-Policies.
 * Ein Client, der PERMISSION-Checks umgeht (z. B. modifizierter Mobile-Build), darf trotzdem
 * niemals mehr sehen/ändern können als die Datenbank erlaubt.
 */
export const PERMISSION = {
  EMPLOYEES_READ: 'employees.read',
  EMPLOYEES_CREATE: 'employees.create',
  EMPLOYEES_UPDATE: 'employees.update',
  EMPLOYEES_DELETE: 'employees.delete',

  TIME_READ: 'time.read',
  TIME_CREATE: 'time.create',
  TIME_UPDATE: 'time.update',
  TIME_APPROVE: 'time.approve',

  LEAVE_READ: 'leave.read',
  LEAVE_REQUEST: 'leave.request',
  LEAVE_APPROVE: 'leave.approve',
  LEAVE_REJECT: 'leave.reject',

  DOCUMENTS_READ: 'documents.read',
  DOCUMENTS_UPLOAD: 'documents.upload',
  DOCUMENTS_DELETE: 'documents.delete',

  PAYROLL_READ: 'payroll.read',
  PAYROLL_CREATE: 'payroll.create',
  PAYROLL_UPDATE: 'payroll.update',
  PAYROLL_APPROVE: 'payroll.approve',

  REPORTS_READ: 'reports.read',

  SETTINGS_READ: 'settings.read',
  SETTINGS_WRITE: 'settings.write',

  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',
  PERMISSIONS_MANAGE: 'permissions.manage',
} as const;

export type PermissionKey = (typeof PERMISSION)[keyof typeof PERMISSION];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSION);
