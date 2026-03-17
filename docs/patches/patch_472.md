# Patch 472

## Titel
AI-/Request-Robustheit Follow-up: Timeout-Signal klar getrennt von manuellem Abort

## Kontext
Patch 471 hat den harten Orchestrator-Request-Timeout bereits eingeführt. Im Ergebnis-Text war Timeout vs. externes Abort-Signal jedoch noch nicht klar getrennt, weil Provider-Aborts im Timeout-Fall als generisches `Request abgebrochen` zurücklaufen konnten.

## Änderungen (minimal)

1) `lib/orchestrator/index.ts`
- Pro Attempt wird weiterhin ein lokaler `AbortController` mit hartem Timeout (`45_000ms`) genutzt.
- Neu: Timeout wird lokal als `timedOut` markiert.
- Falls der Attempt fehlschlägt und `timedOut=true`, wird der Fehlertext deterministisch auf `Request timeout nach 45000ms` gesetzt.
- Externes Abort-Signal bleibt unverändert: echte User-/Flow-Abbrüche liefern weiterhin `Request abgebrochen`.

2) `lib/__tests__/orchestrator.test.ts`
- Bestehender Timeout-Regressionstest präzisiert: erwartet jetzt explizit `timeout` statt generischem Abort.
- Neuer Regressionstest: externes `AbortController.abort()` bleibt als `abgebrochen` klassifiziert.

## Verifikation
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Offen
- Keine Broad-Refactors im Chat-/Provider-/Prompting-Design.
- Retry-/Backoff-Struktur aus Patch 471 bleibt unverändert.
