# Patch 355 — CI Lite: echte Run-Fehler korrekt anzeigen

## Problem
Der CI‑Lite Dialog konnte **„Alles grün“** anzeigen, obwohl der GitHub‑Run im Detail **fehlgeschlagen** war.
Ursache: Wenn Logs leer/gekürzt waren oder die Run-Details nicht sauber ausgewertet wurden, fiel die UI auf „keine Fehler im Log“ zurück und markierte fälschlich OK.

## Fix
- `useCiLiteWorkflow`: **Run‑Conclusion hat Vorrang.**
  - Wenn `workflowRun.conclusion` vorhanden ist:
    - `success` → OK
    - alles andere (`failure`, `cancelled`, `timed_out`, …) → **Fehler**
  - Nur wenn `conclusion` fehlt, wird noch auf Log‑Parsing zurückgefallen.
- Persistierte `lintOk/typeOk` Werte berücksichtigen `conclusion` (bei non‑success werden beide **false** gespeichert, statt „grün“ zu lügen).

## Betroffene Dateien
- `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`

## Tests
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
