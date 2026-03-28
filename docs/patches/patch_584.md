# Patch 584 – Zwei letzte kleine Pure-Logic-Extracts in ChatAIFlow + GitHubReposScreen

## Ziel
Kleiner Kombi-Schritt mit je einem klaren Pure-Logic-Block pro Hook-Hotspot, ohne Hook-Redesign und ohne Aenderung der Async-/Dialog-/Orchestrierungsfluesse.

## Aenderung A – `hooks/useChatAIFlow.ts`
- Neuer lokaler Helper `hooks/chatAIFlowNoticeHelpers.ts` mit:
  - `getBuilderFailureDetails(result)`
  - `getBuilderFailureMessage(result)`
- `useChatAIFlow.ts` nutzt den Helper jetzt beim Builder-Non-OK-Fallback (`!ai || !ai.ok`) statt inline Error-String-Building.

Extrahierter Block: **Error-/Fallback-Textbildung fuer Builder-Fehlermeldung**.

## Aenderung B – `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
- Erweiterung von `screens/GitHubReposScreen/hooks/githubReposScreenNoticeHelpers.ts` um:
  - `getRepoSuccessNotice(action, target)`
- `useGitHubReposScreen.ts` nutzt diese pure Mapping-Funktion fuer Success-Alerts in:
  - `handleCreateRepo`
  - `handleRenameRepo`
  - `handleDeleteRepo`
  - `handleDeleteBranch`

Extrahierter Block: **Success-/Result-Text-Mapping fuer Repo-/Branch-Erfolgsdialoge**.

## Semantik / bewusst unveraendert
- Kein API-Vertragswechsel nach aussen.
- Kein beabsichtigter Verhaltenswechsel bei:
  - planner / builder / validator / done / failed im Chat-Flow
  - Warning-/Notice-/Error- und Success-Textinhalt
  - Repo erstellen / umbenennen / loeschen
  - Branch loeschen
  - Busy-/Loading-/Dialog-/Request-Orchestrierung in beiden Hooks

## Tests / Absicherung
- Neu: `__tests__/chatAIFlowNoticeHelpers.test.ts`
  - Fehlerdetails-Prioritaet (`error` vor `errors[]`)
  - Fallback auf joined `errors[]`
  - stabiler Unknown-Fallbacktext
- Erweitert: `__tests__/githubReposScreen.noticeHelpers.test.ts`
  - `getRepoSuccessNotice(...)` fuer create / rename / delete-repo / delete-branch
- Weiter ausgefuehrt (Regression):
  - `__tests__/useChatAIFlow.summary.regression.test.ts`
  - `__tests__/githubReposScreen.pullPushSemantics.test.ts`

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/chatAIFlowNoticeHelpers.test.ts __tests__/githubReposScreen.noticeHelpers.test.ts __tests__/useChatAIFlow.summary.regression.test.ts __tests__/githubReposScreen.pullPushSemantics.test.ts`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`
