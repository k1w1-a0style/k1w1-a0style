# AI START HERE (Deutsch)

Diese Repo ist eine React-Native-/Expo-App mit Supabase Edge Functions, Diagnostics-/Build-Orchestrierung und einem Preview-/AI-System.

Wenn du mit einem AI/Codex-Agent arbeitest: **lies zuerst**
- `AGENTS.md` (Arbeitsregeln)
- `docs/INDEX.md` (kanonischer Navigationspunkt)
- `docs/PROJECT_CONTEXT.md` (Produkt-/Betriebskontext)
- `docs/SYSTEM_README.md` (aktuelles Systembild)
- `docs/reviews/Review.md` (aktueller Gesamtstatus)
- `docs/TODO.md` (Restpunkt-SoT)

## Schnellstart (lokal)

```bash
npm ci
npm run typecheck
npm run lint:ci
npm run test:silent
```

## Wo ist was?

- Einstieg: `App.tsx`
- Haupt-Screens: `screens/*`
- Business-Logik: `lib/*`
- Infra / Storage / GitHub: `infra/*`
- Supabase / Edge: `supabase/*`
- Tests: `__tests__/*`, `lib/__tests__/*`

## Wichtige aktuelle Regeln

- Legacy-Functions `trigger-lint`, `check-lint`, `trigger-native-sync`, `check-native-sync`, `native-sync-report`, `native-sync-report-ingest`, `create_codesandbox` sind repo-seitig entfernt
- produktive KI-Requests laufen ueber `k1w1-handler`
- bei Edge-Aenderungen immer Request-Validation, CORS, Rate-Limits und Auth-Vertrag mitdenken


## Prompt-Vorlage

- `docs/codex/PROMPT_DE.md`
