# Patch 582 – Zwei kleine Pure-Logic-Extracts in GitHubReposScreen + CI-Lite-Workflow

## Ziel
Naechster kleiner, reviewbarer Kombi-Schritt mit genau einem kleinen pure-logic-Block pro Ziel-Hook, ohne Hook-Redesign oder Flow-Umbau.

## Aenderung A – `useGitHubReposScreen.ts`
- Neuer lokaler Helper: `screens/GitHubReposScreen/hooks/githubReposScreenDialogHelpers.ts`
  - `getDeleteRepoConfirmDialog(...)`
  - `getDeleteBranchConfirmDialog(...)`
- `useGitHubReposScreen.ts` nutzt diese Helper jetzt fuer die Confirm-/Dialog-Textbildung bei Delete-Aktionen (Repo und Branch), statt die Strings inline doppelt aufzubauen.

## Aenderung B – `useCiLiteWorkflow.ts`
- Neuer lokaler Helper: `components/CiLiteHeaderButton/hooks/useCiLiteWorkflowStatusHelpers.ts`
  - `deriveCiLiteHeaderState(...)`
- `useCiLiteWorkflow.ts` nutzt diesen Helper jetzt fuer die Header-Lampenableitung (`running`/`success`/`failure`/`idle`) statt inline-verzweigter Statusberechnung im Effect.

## Semantik / bewusst unveraendert
- Keine API-Aenderung nach aussen.
- Keine beabsichtigte Semantik-Aenderung bei:
  - Repo/Branch Delete-Confirm-Dialogen
  - CI-Lite Header-Status-Lampe
  - Polling-/Timer-/Dispatch-/Artifact-Flow
  - Busy-/Error-/Notice-Orchestrierung in beiden Hooks

## Tests / Absicherung
- Neu: `__tests__/githubReposScreen.dialogHelpers.test.ts`
  - Delete-Repo-/Delete-Branch-Dialogtexte bleiben vertragstreu.
- Neu: `__tests__/useCiLiteWorkflowStatusHelpers.test.ts`
  - Header-Lampenmapping fuer aktive/abgeschlossene/hydrierte/default-Zustaende.
- Weiter ausgefuehrt:
  - `__tests__/githubReposScreen.pullPushSemantics.test.ts`
  - `__tests__/useCiLiteWorkflow.behavior.test.tsx`

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/githubReposScreen.dialogHelpers.test.ts __tests__/useCiLiteWorkflowStatusHelpers.test.ts __tests__/githubReposScreen.pullPushSemantics.test.ts __tests__/useCiLiteWorkflow.behavior.test.tsx`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`
