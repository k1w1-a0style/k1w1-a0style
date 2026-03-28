# Patch 581 – Kleine Entflechtung: Chat-AI-Flow Stage-/Result-Mapping

## Ziel
Naechster kleiner, reviewbarer Entflechtungsschritt in `hooks/useChatAIFlow.ts`: wiederholtes Stage-/Result-/Warning-Mapping fuer Validator-Fallbacks und Source-Summary aus dem Hook ziehen, ohne Orchestrierungsumbau.

## Aenderung
- Neuer lokaler pure Helper: `hooks/chatAIFlowStageHelpers.ts`
  - `getValidatorFallbackWarning(...)` mappt `validatorState` -> stabile userlesbare Warning-Texte.
  - `getSourceSummaryText(...)` mappt `finalFileSource` + `agentEnabled` -> stabile Source-Summary.
- `hooks/useChatAIFlow.ts` nutzt die Helper jetzt im Validator- und Summary-Pfad:
  - Warning-Textbildung laeuft zentral ueber `getValidatorFallbackWarning(...)`.
  - Source-Summary-Bildung laeuft zentral ueber `getSourceSummaryText(...)`.

## Semantik / bewusst unveraendert
- Hook bleibt Orchestrator (Planner/Builder/Validator/Explain/Apply-Flow unveraendert).
- Keine API-Aenderung nach aussen.
- Keine beabsichtigte Semantik-Aenderung bei:
  - `validatorState` (`validated`, `builder-fallback-empty/error/exception`, `disabled`)
  - Validator-Warning-Texten
  - Source-Summary im Result-Dialog

## Tests / Absicherung
- Neu: `__tests__/chatAIFlowStageHelpers.test.ts`
  - `validatorState` -> Warning-Text Mapping
  - `finalFileSource` + `agentEnabled` -> Source-Summary Mapping
- Nachgezogen: `__tests__/useChatAIFlow.validatorExplain.invariants.test.ts`
  - Invariant: Hook nutzt Helper fuer Validator-Warnings
  - Explain-Warnung weiterhin user-sichtbar
- Weiter relevant: `__tests__/useChatAIFlow.summary.regression.test.ts`

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/chatAIFlowStageHelpers.test.ts __tests__/useChatAIFlow.validatorExplain.invariants.test.ts __tests__/useChatAIFlow.summary.regression.test.ts`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`
