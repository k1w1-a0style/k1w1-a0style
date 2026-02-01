# AI START HERE (Deutsch)

Diese Repo ist eine React-Native/Expo App (SDK 54) mit Supabase Edge Functions + einem Preview-System.

Wenn du mit einem **AI/Codex Cloud Agent** arbeitest: **lies zuerst**
- `AGENTS.md` (Arbeitsregeln)
- `PROJECT_CONTEXT.md` (Projekt-Kontext)
- `SYSTEM_README.md` (Gesamt-System)

## 1) Schnellstart (lokal)

```bash
npm ci
npm run typecheck
npm run lint:ci
npm run test:silent
```

## 2) Wo ist was?

- App Einstieg: `App.tsx`
- Haupt-Screens: `screens/*`
- Styles: `styles/*` + `theme.ts`
- Business-Logik: `lib/*`
- Supabase: `supabase/*` (Migrations + Edge Functions)
- Templates: `templates/*` (Expo SDK 54 Basis)

## 3) Preview-System (sehr grob)

- Supabase Preview (empfohlen): `supabase/functions/save_preview` + `supabase/functions/preview_page`
- CodeSandbox Preview: `supabase/functions/create_codesandbox`
- UI: `screens/PreviewScreen.tsx`, `screens/PreviewFullscreenScreen.tsx`

## 4) Wenn du etwas änderst

- **Keine** Breaking Changes ohne sehr guten Grund.
- Änderungen klein halten, danach: `npm run typecheck && npm run lint:ci && npm run test:silent`.
- Bei Edge Functions: Request-Validation + Security Checks immer mitdenken.

## 5) Codex Prompt

Wenn du einen fertigen Prompt brauchst (Deutsch, codex-kompatibel):
- `CODEX_PROMPT_DE.md`
