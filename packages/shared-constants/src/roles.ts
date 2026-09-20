/**
 * Rollen – Single Source of Truth für Web + Mobile.
 * Muss synchron mit `roles.name` in der Datenbank bleiben (siehe docs/permissions.md).
 *
 * WICHTIG: Diese Konstanten dienen nur der UI-Organisation (z. B. welche Route-Group
 * angezeigt wird). Die tatsächliche Zugriffskontrolle läuft ausschließlich serverseitig
 * über RLS + auth.has_permission() (siehe docs/security.md). Ein Vergleich gegen ROLE hier
 * ist niemals eine Sicherheitsprüfung.
 */
export const ROLE = {
  SUPER_ADMIN: 'super_admin',
  COMPANY_ADMIN: 'company_admin',
  HR_ADMIN: 'hr_admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ALL_ROLES: Role[] = Object.values(ROLE);
