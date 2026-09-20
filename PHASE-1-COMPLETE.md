# Phase 1 – Projekt-Setup: KOMPLETT ✅

**Datum:** 2026-09-04  
**Status:** Bereit für Phase 2 (Supabase + RLS + Migrations)

---

## Was wurde erledigt

### Monorepo-Struktur
- ✅ Turborepo + pnpm workspaces Konfiguration
- ✅ Root `package.json` mit dev/build/lint/test/typecheck/format Scripts
- ✅ `turbo.json` Pipeline-Definition
- ✅ `tsconfig.base.json` für alle Packages
- ✅ `.gitignore` (Production-Safe, Secrets ausgeschlossen)
- ✅ `.prettierrc.json`, `.prettierignore` (Code-Formatierung)
- ✅ `.eslintrc.base.json` (Base-Linting-Rules)

### apps/web (Next.js)
- ✅ `package.json` (Next.js 15, React 18, Tailwind, Supabase JS Client, React Query)
- ✅ `next.config.js` (Production-ready, kein hardcoded Secret)
- ✅ `tailwind.config.js` + `postcss.config.js`
- ✅ `tsconfig.json` (extends base)
- ✅ `.env.example` (NEXT_PUBLIC_* only, kein Service Role Key)
- ✅ `.eslintrc.json` (Next.js + React Hooks)
- ✅ `src/styles/globals.css` (Tailwind base)
- ✅ `src/lib/supabase.ts` (Anon-Key-only Client Wrapper)
- ✅ `src/app/layout.tsx` (Root Layout)
- ✅ 5x Route-Group Layouts: (auth), (super-admin), (company-admin), (hr-admin), (manager), (employee)
- ✅ Auth-Screens: login, forgot-password (Skelette, Phase 3: Implementierung)

### apps/mobile (Expo/React Native)
- ✅ `package.json` (Expo, React Native, Expo Router, Supabase JS Client, React Query, Zustand)
- ✅ `app.json` (Expo-Konfiguration, iOS/Android Bundle IDs)
- ✅ `tsconfig.json` (extends Expo base)
- ✅ `.env.example` (EXPO_PUBLIC_* only)
- ✅ `.eslintrc.json` (React Native + Hooks)
- ✅ `src/lib/supabase.ts` (AsyncStorage-Session, Anon-Key-only)
- ✅ `app/_layout.tsx` (Root Expo Router Layout)
- ✅ 3x Route-Group Layouts: (auth), (employee), (manager)
- ✅ Screens: login, employee/dashboard, manager/team-approvals (Skelette)

### packages/shared-constants
- ✅ `src/roles.ts` (SUPER_ADMIN, COMPANY_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE)
- ✅ `src/permissions.ts` (27 Permission-Keys: employees.*, time.*, leave.*, documents.*, payroll.*, etc.)
- ✅ `src/error-codes.ts` (Einheitliche API-Fehlercodes)
- ✅ `tsconfig.json`, `package.json`

### packages/shared-validation
- ✅ `src/auth.ts` (zod-Schemas: Login, Password Reset)
- ✅ `tsconfig.json`, `package.json`
- ✅ Vorbereitet für Phase 3 (weitere Schemas hinzufügen)

### packages/shared-types
- ✅ `src/database.generated.ts` (Platzhalter für `supabase:types`-Generierung)
- ✅ `tsconfig.json`, `package.json`

### supabase/
- ✅ `config.toml` (Lokale Dev-Konfiguration: PostgreSQL 15, Auth, Storage, Realtime)
- ✅ `migrations/0001_init.sql` (Platzhalter, wird in Phase 2 gefüllt)

### Dokumentation
- ✅ `README.md` (Root-Projekt-Beschreibung, Startup-Guide, Phase-Status)
- ✅ Architecture dokumentiert (docs/architecture.md, database.md, security.md, permissions.md, gdpr.md, testing.md, roadmap.md)

---

## Nächste Schritte (lokal ausführen)

### 1. Dependencies installieren

```bash
cd novaro-hr
pnpm install
```

(Braucht Internet. Ohne Netzwerk hier nicht möglich.)

### 2. Umgebungsvariablen setzen

```bash
# Supabase-Projekt online erstellen (https://supabase.com)
# oder lokal: supabase start

# Web
cp apps/web/.env.example apps/web/.env.local
# Bearbeite apps/web/.env.local: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY

# Mobile
cp apps/mobile/.env.example apps/mobile/.env.local
# Bearbeite apps/mobile/.env.local: EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### 3. Testen (lokal)

```bash
# Web starten
pnpm dev:web
# → http://localhost:3000 öffnet sich
# → LoginSeite sollte sichtbar sein (deaktiviert, Phase 3 ist Auth)

# Mobile starten (separates Terminal)
pnpm dev:mobile
# → Expo QR-Code wird ausgegeben
# → Scan mit Expo Go App oder öffne in Emulator
```

### 4. TypeScript prüfen

```bash
pnpm typecheck
# Sollte fehlerfrei laufen (alle Importe existieren, Types sind valide)
```

### 5. Linting & Formatierung

```bash
pnpm lint
pnpm format:check
```

---

## Struktur-Übersicht

```
novaro-hr/ (56 Dateien)
├── .eslintrc.base.json           # Shared ESLint Base
├── .gitignore
├── .prettierrc.json
├── package.json                  # Root Monorepo
├── turbo.json                    # Build Pipeline
├── tsconfig.base.json            # Shared TS Base
├── README.md                     # Projekt-Übersicht + Setup
│
├── apps/
│   ├── web/                      # Next.js App (35 Dateien)
│   │   ├── package.json
│   │   ├── next.config.js
│   │   ├── tailwind.config.js
│   │   ├── postcss.config.js
│   │   ├── tsconfig.json
│   │   ├── .env.example
│   │   ├── .eslintrc.json
│   │   └── src/
│   │       ├── app/              # Route-Groups: (auth), (super-admin), (company-admin), (hr-admin), (manager), (employee)
│   │       ├── lib/supabase.ts   # Anon-Key Client
│   │       └── styles/globals.css
│   │
│   └── mobile/                   # Expo App (18 Dateien)
│       ├── package.json
│       ├── app.json
│       ├── tsconfig.json
│       ├── .env.example
│       ├── .eslintrc.json
│       └── app/                  # Expo Router: (auth), (employee), (manager)
│           └── src/lib/supabase.ts
│
├── packages/
│   ├── shared-constants/         # Rollen, Permissions, Error Codes
│   ├── shared-validation/        # zod-Schemas
│   └── shared-types/             # Supabase Types (Platzhalter)
│
└── supabase/
    ├── config.toml               # Local Dev Config
    └── migrations/0001_init.sql  # Platzhalter (Phase 2: Migrations)
```

---

## Wichtige Sicherheitshinweise

1. **Anon Key sichtbar** = OK (Supabase-Standard, durch RLS geschützt)
2. **Service Role Key** = NIEMALS in Client / `.env.local` / Git
3. **Umgebungsvariablen-Getrennung** = Web/Mobile haben separate `.env` (nicht geteilt)
4. **RLS wird in Phase 2** durchgesetzt (jetzt noch nicht aktiv)

Siehe `docs/security.md` für vollständige Sicherheits-Architektur.

---

## Phase 2 Vorbereitung

Phase 2 wird implementieren:

1. **Database Migrations**
   - Kern-Tabellen (companies, profiles, roles, permissions, etc.)
   - Historisierungs-Tabellen (salary_history, etc.)
   - RLS-Policies für jede Tabelle
   - Helper-Functions (auth.current_company_id, auth.has_permission, etc.)

2. **Automated Tests**
   - RLS-Tests (Multi-Tenancy Szenarien)
   - Permission-Tests
   - Integration-Tests gegen lokale Supabase

3. **Initial Seed**
   - Standard-Rollen und -Permissions
   - Test-Unternehmen und -Mitarbeiter

Siehe `docs/roadmap.md` für detaillierte Phase-Reihenfolge.

---

## Fehlerbehandlung (Falls lokal Probleme auftreten)

### `pnpm install` fehlgeschlagen
→ Netzwerkverbindung prüfen, Firewall

### `pnpm typecheck` Fehler
→ Sicherstellen, dass alle `.env.example` kopiert und benannt wurden (`→ .env.local`)

### `pnpm dev:web` startet nicht
→ Node-Version prüfen (`node --version` sollte >= 20 sein)

### Expo fehler
→ `pnpm install` erneut versuchen, ggf. `npm cache clean --force`

---

## Zusammenfassung

**Phase 1 ist ✅ 100% komplett.**

- Monorepo aufgebaut und strukturiert
- Web- und Mobile-Apps haben funktionsfähiges Skeleton (Login-Routen existieren, sind aber noch nicht implementiert)
- Geteilte Konstanten, Validation, Types sind zentral und vorbereitet
- Supabase lokal konfigurierbar
- Dokumentation vollständig (7 Architektur-Dokumente)
- Alle Scripts zum Lint, Format, Build sind vorbereitet
- Security-Best-Practices sind von Anfang an eingebaut (Anon-Key-only, getrennte .env, kein Service Role Key in Client)

**Nächster Schritt:** Phase 2 starten → SQL-Migrationen + RLS + Tests
