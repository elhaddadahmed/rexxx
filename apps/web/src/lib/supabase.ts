/**
 * Supabase Client Wrapper für Web-App.
 *
 * WICHTIG:
 * - Der Anon Key ist im Browser sichtbar — das ist OK (wird von Supabase so vorgesehen).
 * - Der Service Role Key gehört NIEMALS hierhin oder ins Client-Bundle.
 * - Serverseitige Route Handler / Edge Functions verwenden einen separaten Context
 *   mit eigenem Secret (konfiguriert über process.env.SUPABASE_SERVICE_ROLE_KEY,
 *   nicht über diese Datei).
 * - Diese Datei existiert nur für Browser/App-Context.
 *
 * Siehe docs/security.md, Abschnitt 10.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@novaro/shared-types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
