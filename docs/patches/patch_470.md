# Patch 470

## Titel
k1w1-handler Follow-up: früher Parse-Error-Pfad auf sicheren Client-Error-Vertrag angleichen

## Kontext
Nach Patch 469 blieb ein echter Restpunkt offen:
- Der frühe `parseJsonBody(...)`-Fehlerpfad gab weiterhin `parsedBody.error` roh an Clients zurück.

## Änderungen (minimal)

1) `supabase/functions/k1w1-handler/index.ts`
- Früher Parse-/Body-Fehlerpfad liefert jetzt konsistente, generische Client-Errors:
  - `Request too large.` bei Payload-Limit (HTTP 413)
  - `Invalid request payload.` für sonstige Parse-/Body-Fehler (HTTP 400)
- Kein direktes Durchreichen von `parsedBody.error` mehr.
- Optionaler Typing-Rest minimal nachgezogen: `catch (err: unknown)` + enges Narrowing für Logging.

2) `__tests__/edgeErrorExposure.invariants.test.ts`
- Invariants erweitert, damit auch der frühe Parse-/Body-Fehlerpfad gegen direkten Rohtext-Leak abgesichert ist.
- Zusätzlich abgesichert, dass der Catch-Block auf `unknown` läuft.

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
- Kein weiterer Umbau außerhalb des bestätigten Restpunkts.
