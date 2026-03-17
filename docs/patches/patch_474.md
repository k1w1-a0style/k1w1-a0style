# Patch 474

## Titel
Chat-AI-Flow Timeout-Restpunkt final abgesichert (Wiring-Invariants)

## Kontext
Der geforderte harte Timeout in `useChatAIFlow` ist implementiert. Zur Absicherung gegen Regressionsdrift wurde der konkrete Wiring-Vertrag für alle relevanten Stage-Calls (Planner/Builder/Validator/Explain) jetzt zusätzlich invariant getestet.

## Änderungen (minimal)

1) `__tests__/useChatAIFlow.hardTimeout.invariants.test.ts`
- Prüft, dass alle relevanten Stage-Calls in `processAIRequest(...)` über `runOrchestratorWithHardTimeout(...)` laufen:
  - Planner
  - Builder (inkl. Retry)
  - Validator
  - Explain
- Prüft, dass im `processAIRequest(...)`-Block keine direkte `await runOrchestrator(...)`-Verwendung mehr vorhanden ist.

2) Doku-/Status-Sync
- `docs/patches/PATCHLOG_ROOT.md`
- `PROJECT_CHECKLOG.md`
- `README.md`
- `docs/TODO.md`

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
- Kein Broad-Refactor.
- Retry/Backoff unverändert.
