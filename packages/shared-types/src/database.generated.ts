/**
 * PLATZHALTER — wird automatisch überschrieben durch:
 *   pnpm supabase:types
 * (siehe package.json, Root) sobald in Phase 2 echte Migrationen existieren.
 *
 * Nicht manuell bearbeiten. Solange keine Migrationen existieren, exportiert diese Datei
 * einen minimalen, aber gültigen Platzhalter-Typ, damit apps/web und apps/mobile bereits
 * jetzt fehlerfrei gegen @novaro/shared-types kompilieren.
 */
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
