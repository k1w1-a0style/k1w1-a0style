# Patch 770 — ResidualRestblockFinalization + LiveContractTruthSync

## Kontext
Der verbleibende Restblock sollte final und ohne neue Grossbaustelle abgeschlossen werden: alle 5 Hotspots erneut bewerten, direkte Hygiene-Reste im Scope schliessen und SoT/Runbooks auf den realen Live-/Release-Stand ziehen.

## Umsetzung
1. **ChatScreenHookResidual (direkter Scope-Fix)**
   - `useChatScreen.ts`: bisher stumme `scrollToEnd`-Catch-Pfade (primary + retry) loggen jetzt sichtbar via `logger.warn(...)`.
   - Keine Aenderung an Input-/Attachment-/Send-/Flow-Semantik, nur Observability-Haertung.

2. **CiLite/EnhancedBuild/CredentialsWizard/GitHubWorkflows Residual Final Scan**
   - `useCiLiteWorkflow.ts`, `useEnhancedBuildScreen.ts`, `useCredentialsWizardScreen.ts` und `infra/github/workflows.ts` wurden erneut im direkten Scope geprueft.
   - Ergebnis: verbleiben bewusst als schlanke Orchestrator-Fassaden; weiterer Split haette aktuell keinen klaren Sicherheits-/Wartungsgewinn ohne neue Regression-/Review-Kosten.

3. **Live-Truthfulness + JWT/Secret-Doku-Nachzug**
   - Kern-SoT und Runbooks wurden auf den echten Status synchronisiert:
     - `OK_FULL` nur mit gesetzten Live-Variablen (`EDGE_BASE_URL`, `EDGE_OPERATOR_JWT`),
     - sonst korrekt `OK_WITH_SKIPS`.
   - Klarstellung nachgezogen: fuer den interaktiven `k1w1-handler`-Livevertrag wird ein frischer usergebundener `build_admin`-JWT genutzt; `service_role` ist dafuer kein gleichwertiger User-Ersatz.

## SoT-/Docs-Nachzug
- Header-/Patchstand auf Patch 770 synchronisiert in den Kern-MDs und Runbooks.
- Patchlog/Checklog um den aktuellen Abschlusslauf erweitert.

## Validierung
- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_verify_jwt_visibility.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run -s docs:lint`
- `bash scripts/check_release_readiness.sh`
- `bash scripts/check_edge_live_env_readiness.sh`
- `bash scripts/check_edge_live_contracts.sh` (nur falls Live-Variablen gesetzt)
