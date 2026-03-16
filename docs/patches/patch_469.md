# Patch 469

## Titel
Edge Security Hardening: Preview-XSS/Error-Exposure + k1w1-handler Client-Error-Leak

## Kontext
Bestätigte Restpunkte in produktionsnahen Edge-/Preview-Pfaden:
- `preview_page` zeigte Runtime-Fehler über HTML-Interpolation (inkl. potentieller Stack-/HTML-Injection).
- `k1w1-handler` gab rohe interne Fehlermeldungen (`err.message`) direkt an Clients zurück.

## Änderungen (minimal, ohne Broad-Refactor)

1) `supabase/functions/preview_page/index.ts`
- Error-Overlay auf sichere DOM-Erzeugung (`createElement` + `textContent`) umgestellt.
- Direkte Fehler-HTML-Interpolation entfernt.
- Client-seitige Fehlermeldung zusätzlich lokal normalisiert/begrenzt (`sanitizeClientErrorText`).
- Ladezustand ebenfalls über denselben sicheren Overlay-Pfad (`setOverlayState("loading")`).

2) `supabase/functions/k1w1-handler/index.ts`
- Response-Fehler für Clients gehärtet:
  - Validierungs-/Requestfehler: `Invalid request payload.` (HTTP 400)
  - sonst: `Internal Server Error` (HTTP 500)
- Rohes `err.message` wird **nicht** mehr an Clients zurückgegeben.
- Interne Details bleiben serverseitig in `console.error(...)` erhalten.

3) Regression-/Invariant-Tests
- `__tests__/edgeErrorExposure.invariants.test.ts` ergänzt:
  - Verhindert Wieder-Einführung von raw stack/message HTML-Interpolation in `preview_page`.
  - Verhindert Wieder-Einführung von direktem `err.message`-Leak im `k1w1-handler`-Client-Response.

## Verifikation
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Offene Punkte
- Keine neuen Broad-Spectrum-Cleanups durchgeführt.
- Nur bestätigte Security-/Exposure-Pfade in `preview_page` und `k1w1-handler` gehärtet.
