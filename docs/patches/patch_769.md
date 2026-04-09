# Patch 769 — ResidualHotspotTightening + ScopedObservabilityFollowup

## Kontext
Nach dem Patch-768-Lauf blieb Feedback offen, dass der Restblock nicht nur dokumentiert, sondern direkt im Hotspot-Scope weiter gestrafft werden soll.

## Umsetzung
1. **ChatScreenResidual**
   - `useChatScreen.ts`: Prefill-/Route-Param-Cleanup aus dem Haupt-Hook ausgelagert nach `chatScreenPrefill.ts`.
   - Stummer Catch wurde ersetzt: Param-Cleanup-Fehler werden jetzt per `logger.warn(...)` sichtbar.

2. **CiLiteWorkflowResidual**
   - `useCiLiteWorkflow.ts`: Logline-Ableitung in `resolveCiLiteLogLines(...)` ausgelagert.
   - Pending-/Hydrated-/Run-Log-Semantik bleibt unveraendert, aber der Haupt-Hook wurde weiter als Orchestrator gestrafft.

3. **EnhancedBuildScreenResidual**
   - `useEnhancedBuildScreen.ts`: Log-bezogene Derivationen (`analyses`, `logsErrorSafe`, `logLines`) in neuen Hook `useEnhancedBuildLogState.ts` gezogen.
   - Build-Start-/Readiness-/Selection-/Refresh-Semantik bleibt unveraendert.

4. **GitHubWorkflowsInfraResidual + WeakFallbackHygieneFollowup**
   - `infra/github/workflows.ts`: JSON-Parse-Fehler im Dispatch-Errorpfad sind jetzt observierbar (`logger.warn(...)`) statt still auf `{}` zu fallen.
   - Fehlervertrag bleibt fail-closed, kein API-Break.

5. **CredentialsWizardResidual (Bewertung)**
   - Keine weitere Zerlegung erzwungen: bestehender Schnitt `useCredentialsWizardScreen` + `useCredentialsWizardActions` + `useCredentialsWizardUiState` ist aktuell ausreichend schlank ohne klaren Zusatzgewinn durch weitere Splits.

## SoT-/Docs-Nachzug
- Stand-/Patchheader auf Patch 769 synchronisiert (`README`, `TODO`, `Review`, `INDEX`, `TESTING_GUIDE`, `FRESH_CHECKOUT`, `EDGE_FUNCTIONS_STATUS`).
- Checklog/Patchlog auf denselben Patchstand gezogen.

## Validierung
- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_verify_jwt_visibility.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run -s docs:lint`
- `bash scripts/check_release_readiness.sh`
- `bash scripts/check_edge_live_env_readiness.sh` (env-abhaengig)
- `bash scripts/check_edge_live_contracts.sh` (env-abhaengig)
