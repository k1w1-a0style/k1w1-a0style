# Patch 473

## Titel
Chat-AI-Flow: echter harter Timeout für alle `runOrchestrator(...)`-Stages

## Kontext
Nach Patch 471/472 war Retry/Backoff vorhanden, aber im Chat-Flow fehlte weiterhin ein expliziter Stage-Timeout pro `runOrchestrator(...)`-Aufruf (Planner/Builder/Validator/Explain).

## Änderungen (minimal)

1) `hooks/useChatAIFlow.ts`
- Neuer Helper `runOrchestratorWithHardTimeout(...)` mit `CHAT_AI_REQUEST_TIMEOUT_MS = 45_000`.
- Der Helper nutzt pro Call einen lokalen `AbortController`, koppelt ihn an das bestehende Parent-`signal` und bricht den laufenden Orchestrator-Call bei Timeout aktiv ab.
- Timeout und externes Abort werden semantisch getrennt:
  - Timeout → `Request timeout nach <ms>ms`
  - externes Abort → `Request abgebrochen`
- Alle relevanten Stages im Chat-Flow nutzen jetzt den Helper:
  - Planner
  - Builder (inkl. Retry-Aufruf)
  - Validator
  - Explain

2) `__tests__/useChatAIFlow.timeoutAbort.regression.test.ts`
- Regression: hängender Orchestrator-Call wird über Timeout wirklich abgebrochen und als Timeout markiert.
- Regression: externes Abort bleibt als `abgebrochen` klassifiziert.

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
- Kein Broad-Refactor am Chat-/Provider-/Prompting-Design.
- Retry-/Backoff-Mechanik wurde nicht neu gebaut.
