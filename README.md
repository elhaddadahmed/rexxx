# Novaro HR – HR-Verwaltung & Zeiterfassung

**Arbeitstitel** (änderbar). Eigenständige Multi-Tenant-SaaS für HR-Prozesse: Mitarbeiterverwaltung,
Zeiterfassung, Urlaub, Dokumente, Payroll-Integration.

## Tech-Stack

- **Mobile**: React Native (Expo), Expo Router
- **Web**: Next.js 15, Tailwind CSS
- **Backend/Data**: Supabase (PostgreSQL, RLS, Auth, Storage, Edge Functions)
- **Monorepo**: Turborepo, pnpm workspaces

## Projekt-Status

**Phase 1** — Projekt-Setup (aktuell, Abschluss siehe unten).

Detaillierte Roadmap: `docs/roadmap.md`

## Architektur & Sicherheit

- **Dokumentation**: `docs/architecture.md`, `docs/database.md`, `docs/security.md`
- **Rollen & Permissions**: `docs/permissions.md`
- **DSGVO / Datenschutz**: `docs/gdpr.md`
- **Testing-Strategie**: `docs/testing.md`

Wichtig: **Alle Sicherheits-entscheidungen sind dokumentiert und werden serverseitig durchgesetzt
(RLS, Permissions, Audit Logs).** Der Client ist nicht die Sicherheitsgrenze.

## Lokal starten

### Voraussetzungen

- Node.js >= 20
- pnpm >= 9
- Docker (optional, für lokales Supabase)
- Supabase CLI

### Installation

```bash
# Repository klonen und in Verzeichnis wechseln
git clone <repo> novaro-hr
cd novaro-hr

# Dependencies installieren
pnpm install

# Umgebungsvariablen für Web
cp apps/web/.env.example apps/web/.env.local
# Bearbeite apps/web/.env.local und setze echte Supabase-URLs

# Umgebungsvariablen für Mobile
cp apps/mobile/.env.example apps/mobile/.env.local
# Bearbeite apps/mobile/.env.local und setze echte Supabase-URLs
```

### Supabase lokal starten (optional für lokale Entwicklung)

```bash
# Supabase CLI installieren (global oder lokal)
brew install supabase/tap/supabase

# Im Projektverzeichnis starten
supabase start

# Wird angeben: PostgreSQL-URL, API-URLs, Anon Key, Service Role Key für lokale Tests
```

### Web-App starten

```bash
pnpm dev:web
# Öffnet http://localhost:3000 im Browser
```

### Mobile-App starten

```bash
pnpm dev:mobile
# Startet Expo Dev Server, zeigt QR-Code für iOS/Android Emulator oder physisches Gerät
```

## Scripts (Root)

```bash
# Alle Entwicklungs-Server starten
pnpm dev

# Nur Web oder Mobile
pnpm dev:web
pnpm dev:mobile

# TypeScript-Check (alle Packages)
pnpm typecheck

# Linting
pnpm lint
pnpm lint:fix

# Formatierung
pnpm format
pnpm format:check

# Build (Production)
pnpm build

# Supabase Commands
pnpm supabase:start
pnpm supabase:stop
pnpm supabase:migrate
pnpm supabase:types  # Generiert TypeScript-Typen aus Supabase-Schema in packages/shared-types

# Aufräumen (Vollständiger Clean)
pnpm clean
```

## Dateistruktur

```
novaro-hr/
├── apps/
│   ├── mobile/              # Expo React Native App
│   │   ├── app/             # Expo Router Routes
│   │   └── src/
│   └── web/                 # Next.js Admin Web App
│       ├── src/app/         # Next.js App Router
│       └── src/
├── packages/
│   ├── shared-constants/    # Rollen, Permissions, Error Codes
│   ├── shared-validation/   # Zod-Schemas (Web + Mobile teilen sich diese)
│   └── shared-types/        # Supabase-generierte Types + DTOs
├── supabase/
│   ├── migrations/          # SQL-Migrationen (Phase 2+)
│   ├── functions/           # Edge Functions (Deno, Phase 3+)
│   └── config.toml          # Supabase lokal Konfiguration
├── docs/                    # Architektur- & Planungsdokumentation
├── package.json             # Root Monorepo Package
├── turbo.json               # Turborepo Pipeline
└── tsconfig.base.json       # Shared TypeScript Base Config
```

## Phase 1 – Was wurde erledigt?

- ✅ Monorepo-Struktur (Turborepo + pnpm)
- ✅ Next.js-App mit Route-Groups (Auth, Super-Admin, Company-Admin, HR-Admin, Manager, Employee)
- ✅ Expo-App mit Expo Router (Auth, Employee, Manager)
- ✅ Geteilte Konstanten (`shared-constants`: Rollen, Permissions, Error Codes)
- ✅ Geteilte Validierung (`shared-validation`: zod-Schemas)
- ✅ Geteilte Types (`shared-types`: Supabase-Typen Platzhalter)
- ✅ Supabase-Client-Wrapper (beide Apps, Anon-Key only)
- ✅ Umgebungsvariablen-Vorlagen (Web/Mobile getrennt, kein Service Role Key exponiert)
- ✅ Base-Konfigurationen (ESLint, Prettier, TypeScript)
- ✅ Root-README (dieses Dokument)

## Phase 1 – Was ist noch offen?

- Supabase Projekt online erstellen (manuell auf https://supabase.com, oder lokal mit `supabase start`)
- `.env.local`-Dateien mit echten Werten befüllen
- `pnpm install` lokal ausführen (Netzwerk nötig)
- Erste Testläufe (`pnpm dev:web`, `pnpm dev:mobile`) ausführen und fehlerhafte Dependencies reparieren

## Phase 2 Vorbereitung

Phase 2 wird beginnen mit:

1. Supabase-Datenbank-Setup (`supabase migrate up`)
2. RLS-Policies + Helper-Functions
3. Initial Seed (Rollen, Permissions)
4. Automated RLS-Tests

Alle SQL-Migrationen gehören in `supabase/migrations/`, nicht in Supabase Studio UI.

## Sicherheit & Entwicklung

**Wichtig:**
- Der Supabase **Anon Key** ist im Browser/App sichtbar — das ist OK (siehe `docs/security.md`).
- Der Supabase **Service Role Key** gehört NIEMALS in Client-Code, `.env.local` oder Git.
  - Service Role umgeht RLS vollständig.
  - Nur serverseitig in Edge Functions verwenden.
  - Siehe `docs/security.md`, Abschnitt 10.

- Alle DB-Änderungen via Migrationen dokumentieren (nicht über Supabase Studio UI).
- Jede Sicherheitsrichtlinie aus `docs/security.md` wird ernsthaft durchgesetzt — nicht nur
  dokumentiert, sondern auch getestet (siehe `docs/testing.md`).

## Kontakt & Support

Siehe `docs/` für ausführliche Dokumentation.

---

**Stand**: Phase 1 (Projekt-Setup) — 2026-09-04
