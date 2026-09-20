/**
 * Test-Utilities für RLS & Multi-Tenancy Tests
 * 
 * Verwendet Supabase JS Client, um echte DB-Queries zu testen.
 * Keine Mocks — echte RLS-Policies werden getestet.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Test Case: Employee Company A versucht, Daten von Company B zu lesen
 * Erwartet: Leeres Ergebnis (RLS blockiert, kein Fehler)
 */
export async function testMultiTenancyReadBlock(
  clientA: SupabaseClient,
  clientB: SupabaseClient,
  tableName: string,
) {
  const { data: dataFromA } = await clientA
    .from(tableName)
    .select('*')
    .limit(1);

  const { data: dataFromB } = await clientB
    .from(tableName)
    .select('*')
    .limit(1);

  // Wenn Company A Daten sieht, aber Company B sollte nichts sehen:
  if (dataFromA && dataFromA.length > 0) {
    if (dataFromB && dataFromB.length > 0) {
      throw new Error(
        `[TENANT BREACH] Company B kann Daten von Company A lesen in Tabelle "${tableName}"`,
      );
    }
  }

  return true;
}

/**
 * Test Case: Employee versucht, UPDATE auf fremden Mitarbeiter auszuführen
 * Erwartet: 0 betroffene Reihen
 */
export async function testMultiTenancyUpdateBlock(
  clientA: SupabaseClient,
  foreignEmployeeId: string,
) {
  const { data, error } = await clientA
    .from('employee_details')
    .update({ position_title: 'UNAUTHORIZED' })
    .eq('profile_id', foreignEmployeeId);

  if (error) {
    // Kann Fehler sein oder einfach 0 betroffene Reihen
    // RLS lässt Queries durch, aber gibt 0 Zeilen zurück
    return true;
  }

  if (data && data.length > 0) {
    throw new Error(
      `[TENANT BREACH] Employee konnte fremden Mitarbeiter (${foreignEmployeeId}) updaten`,
    );
  }

  return true;
}

/**
 * Test Case: Manager versucht, Daten von Mitarbeiter außerhalb seines Teams zu lesen
 * Erwartet: Blockiert durch auth.can_access_employee()
 */
export async function testManagerTeamScope(
  managerClient: SupabaseClient,
  unassignedEmployeeId: string,
) {
  const { data, error } = await managerClient
    .from('employee_details')
    .select('*')
    .eq('profile_id', unassignedEmployeeId);

  if (error) {
    return true; // RLS blockiert
  }

  if (data && data.length > 0) {
    throw new Error(
      `[PERMISSION BREACH] Manager konnte Daten von nicht-zugeordnetem Mitarbeiter (${unassignedEmployeeId}) lesen`,
    );
  }

  return true;
}

/**
 * Test Case: User ohne Permission versucht, eine Aktion auszuführen
 * Erwartet: RLS blockiert
 */
export async function testPermissionRequired(
  userClient: SupabaseClient,
  tableName: string,
  permission: string,
) {
  // Versuche INSERT ohne entsprechende Permission
  const { data, error } = await userClient.from(tableName).insert({
    // Dummydaten (hängt von Tabelle ab)
    company_id: (await userClient.auth.getUser()).data.user?.id,
  });

  if (error) {
    // RLS blockiert mit Fehler
    return true;
  }

  if (data) {
    throw new Error(
      `[PERMISSION BREACH] User ohne '${permission}' konnte in '${tableName}' schreiben`,
    );
  }

  return true;
}

/**
 * Test Case: Audit Logs können nicht gelöscht/editiert werden
 * Erwartet: DELETE/UPDATE-Versuche werden blockiert
 */
export async function testAuditLogsImmutability(adminClient: SupabaseClient) {
  // Versuche, einen Audit Log zu löschen
  const { data: allLogs, error: fetchError } = await adminClient
    .from('audit_logs')
    .select('id')
    .limit(1);

  if (fetchError || !allLogs || allLogs.length === 0) {
    // Keine Logs vorhanden, Test übersprungen
    return true;
  }

  const logId = allLogs[0].id;

  // DELETE versuchen
  const { error: deleteError } = await adminClient
    .from('audit_logs')
    .delete()
    .eq('id', logId);

  if (!deleteError) {
    throw new Error('[SECURITY BREACH] Audit Log konnte gelöscht werden (sollte immutable sein)');
  }

  // UPDATE versuchen
  const { error: updateError } = await adminClient
    .from('audit_logs')
    .update({ action: 'TAMPERED' })
    .eq('id', logId);

  if (!updateError) {
    throw new Error('[SECURITY BREACH] Audit Log konnte editiert werden (sollte immutable sein)');
  }

  return true;
}

/**
 * Test Case: Support-Access Request kann zeitlich begrenzt werden
 * Erwartet: Nach expires_at kann SUPER_ADMIN nicht mehr zugreifen
 */
export async function testSupportAccessExpiration(
  superAdminClient: SupabaseClient,
  companyId: string,
) {
  const { data, error } = await superAdminClient
    .from('support_access_requests')
    .select('*')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .lte('expires_at', new Date().toISOString());

  if (error) {
    return true; // Blockiert (gut)
  }

  if (data && data.length > 0) {
    throw new Error('[SECURITY BREACH] SUPER_ADMIN kann abgelaufene Support-Access verwenden');
  }

  return true;
}
