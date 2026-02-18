# Patch 67 – AppStatusScreen correctness + perf

## Why
- Status-Screen hatte false negatives:
  - Config wurde nur über `app.config.js` erkannt.
  - Entry-Point wurde fälschlich über `App.tsx` bewertet.
- Bei großen Projekten konnte der Screen stottern (unbounded render + line counting).

## What changed
- Config parsing unterstützt `app.config.ts` / `app.config.js` / `app.json` (priorisiert)
- Entry-Point detection:
  - `package.json.main` file check
  - Special-case `expo-router/entry` (`app/_layout.*`)
  - Fallbacks `index.*` / `App.*`
- UI: stable keys, capped lists mit „… +N weitere“ Anzeige
- Perf: capped line counting
- Tests: `__tests__/appStatusValidation.test.ts`

## Risk
- Sehr niedrig. Änderungen sind read-only Status-Auswertung + render strategy.