# Patch 764

## Titel
Hook-Hotspot-Decomposition-Wave abgeschlossen

## Kontext
Nach dem Contract-/SoT-Follow-up aus Patch 763 wurde der verbleibende Hook-Hotspot-Block in kleinem, risikoarmem Scope weiter zerlegt.

## Aenderungen
1. `hooks/useGitHubRepos.ts`
   - Repo-Load/Delete/Rename Requests nach `hooks/useGitHubReposRequests.ts` ausgelagert
   - Hook bleibt als stabile Fassade (state + callbacks)
2. `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts`
   - UI-/Debug-/Error-/Visibility-State in `useCredentialsWizardUiState.ts` separiert
   - Auth-/Credential-/Status-Flow unveraendert
3. `screens/ChatScreen/hooks/useChatScreen.ts`
   - Attachment-Document-Picker nach `chatScreenDocumentPicker.ts` ausgelagert
   - Send-/Draft-/Attachment-Semantik unveraendert
4. `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts`
   - Build-Actions (`refreshBuildScreenData`, `persistPreferredBuildProfile`) in `enhancedBuildScreenActions.ts` ausgelagert

## Secondary review
- `lib/diagnostics/checks/assetsAndFiles.ts`, `infra/github/workflows.ts`, `screens/GitHubReposScreen/index.tsx`, `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`, `components/CiLiteHeaderButton/hooks/useCiLiteWorkflowHelpers.ts`, `hooks/usePreview.ts` erneut bewertet; kein direkter, risikoarmer Mini-Fix im gleichen Scope erzwungen.

## Verifikation
- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_verify_jwt_visibility.sh`
- `bash scripts/check_release_readiness.sh` (`OK_WITH_SKIPS`, fehlende `EDGE_BASE_URL`/`EDGE_OPERATOR_JWT`)

## Ergebnis
- Hook-Hotspots sind weiter fachlich entmischt, ohne Semantik-/API-Regressions.
- SoT wurde auf Patch 764 synchronisiert.
