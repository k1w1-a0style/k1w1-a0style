# Patch 314: preview_page toggles for raw logs/runtime errors

## Ziel
- Nächsten offenen PR-9 Punkt aus `docs/PROJECT_TODO.md` umsetzen:
  - Optionaler Toggle in `preview_page` für **raw logs** und **runtime errors**.

## Änderung
- `supabase/functions/preview_page/index.ts`
  - Query-Parameter-Toggles ergänzt:
    - `logs=1|0`
    - `runtime_errors=1|0`
  - Header-Actions erweitert um zwei Toggle-Buttons (ON/OFF), die die URL-Parameter umschalten.
  - Optionales Raw-Log-Panel (`<pre id="raw-logs">`) ergänzt.
  - Sandpack-Events/Errors werden bei aktiviertem Log-Toggle in das Panel geschrieben.
  - Runtime-Error-Overlay wird nur noch gezeigt, wenn `runtime_errors` aktiviert ist.
  - Access-Log um Toggle-Status (`logs`, `runtimeErrors`) erweitert.
- `supabase/functions/preview_page/helpers.ts`
  - Re-Exports für `serve`, `rateLimit`, `sanitizeErrorText`, damit `index.ts` zentral aus `helpers` importieren kann.
- `docs/PROJECT_TODO.md`
  - Offenen PR-9 Punkt als erledigt markiert.

## Risiko
- Niedrig bis mittel:
  - Änderung betrifft nur das gerenderte Preview-HTML und optionale Diagnoseanzeige.
  - Default-Verhalten bleibt stabil (beide Toggles standardmäßig AUS).

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
