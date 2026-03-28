# Patch 585 – Letzte kleine Pure-Logic-Extracts in `useChatAIFlow` + `GitHubContext`

## Ziel
Ein letzter kleiner Doppel-Schritt mit je **einem** klaren Pure-Logic-Block pro Ziel-Datei, ohne Hook-/Context-Redesign und ohne API-Vertragsaenderung.

## Aenderung A – `hooks/useChatAIFlow.ts`
- `hooks/chatAIFlowNoticeHelpers.ts` wurde um `getInputValidationMessage(error)` erweitert.
- `useChatAIFlow.ts` nutzt diese Funktion jetzt fuer das bestehende Input-Validation-Warning-Mapping im fruehen Guard vor Planner/Builder.

Extrahierter Block: **kleines Warning-/Advisory-Mapping fuer Validation-Fehlertexte**.

## Aenderung B – `contexts/GitHubContext.tsx`
- `contexts/githubContextHelpers.ts` wurde um `getLinkedMirrorUpdates(...)` erweitert.
- Der Mirror-Effect in `GitHubContext.tsx` nutzt den Helper jetzt fuer die reine Entscheidung, ob `activeRepo`/`activeBranch` aus `projectData.linked*` uebernommen werden sollen.

Extrahierter Block: **kleiner reiner Guard-/Fallback-Block fuer Rehydrated linked repo/branch mirror updates**.

## Semantik / bewusst unveraendert
- Kein Verhaltenswechsel beabsichtigt bei:
  - Planner/Builder/Validator/Done/Failed-Flow
  - Warning-/Notice-/Error-Texte im Chat-Flow
  - `activeRepo` / `activeBranch` / `recentRepos`
  - Rehydration-/Persistenz-/Mirror-Orchestrierung im GitHubContext
- Keine neue Architektur, keine neue State-Maschine.

## Tests / Absicherung
- Erweitert: `__tests__/chatAIFlowNoticeHelpers.test.ts`
  - `getInputValidationMessage(...)` fuer long-input advisory + generic fallback
- Erweitert: `__tests__/githubContextHelpers.test.ts`
  - `getLinkedMirrorUpdates(...)` fuer differ/match-Faelle
- Zusaetzliche fokussierte Regressionen:
  - `__tests__/useChatAIFlow.inputValidation.test.tsx`
  - `__tests__/useChatAIFlow.validatorExplain.invariants.test.ts`

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/chatAIFlowNoticeHelpers.test.ts __tests__/githubContextHelpers.test.ts __tests__/useChatAIFlow.inputValidation.test.tsx __tests__/useChatAIFlow.validatorExplain.invariants.test.ts`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`
