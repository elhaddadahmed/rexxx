/**
 * Einheitliche Fehlercodes für API-Antworten (Edge Functions) und Client-Fehlerbehandlung.
 * Wird erweitert, sobald konkrete Endpunkte entstehen (ab Phase 2).
 */
export const ERROR_CODE = {
  UNAUTHENTICATED: 'unauthenticated',
  UNAUTHORIZED: 'unauthorized', // Permission fehlt
  TENANT_MISMATCH: 'tenant_mismatch', // company_id passt nicht (sollte durch RLS nie erreichbar sein)
  NOT_FOUND: 'not_found',
  VALIDATION_ERROR: 'validation_error',
  RATE_LIMITED: 'rate_limited',
  INTERNAL_ERROR: 'internal_error',
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];
