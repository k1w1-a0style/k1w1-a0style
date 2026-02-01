# Projekt-Kontext (Kurzfassung auf Deutsch)

> Für alle Details siehe `PROJECT_CONTEXT.md` (englisch, ausführlich).

## Worum geht’s hier?

- React Native / Expo App (SDK 54)
- „Preview“-Build/Generator (Sandpack/Code-Preview + Templates)
- Supabase als Backend (DB + Edge Functions)
- Diagnose/Diagnostics Pipeline (Reports, Uploads, Preflight Checks, ...)

## Wichtige Bereiche im Repo

- `screens/` – UI Screens
- `components/` – UI Komponenten
- `lib/` – Kernlogik (Orchestrator, Builder, Diagnostics, ...)
- `supabase/` – Migrations + Edge Functions
- `templates/` – Expo Templates (Base/Full/Navigation/CRUD)

## Tests & Qualität

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

