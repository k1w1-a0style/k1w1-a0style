# Patch 730 - Scout-Handoff-Trigger zentralisiert

## Kontext

Nach Einführung des Scout-Modus soll die Erkennung von Direct-Build-Kommandos an einer zentralen Stelle liegen, damit Handoff-Logik und lokale Qualitätsmetriken nicht auseinanderlaufen.

## Aenderungen

1. `hooks/useChatAIFlow.ts`:
   - neuer Helper `isDirectBuildCommand(...)`.
   - Scout-Handoff nutzt den Helper statt duplizierter Stringchecks.
   - Metrik-Write (`intent_confirmation_build`) nutzt denselben Helper.
2. `__tests__/useChatAIFlow.summary.regression.test.ts`:
   - neue Regression deckt erlaubte Direct-Build-Varianten und einen Negativfall ab.
3. Keine Produkt-/UI-Strukturänderung; reines Konsistenz-/Robustheits-Hardening.

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/useChatAIFlow.summary.regression.test.ts`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
