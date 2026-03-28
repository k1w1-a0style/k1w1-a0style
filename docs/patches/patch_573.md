# Patch 573 – Kleiner Result-Normalisierungs-Extract aus `useChatAIFlow`

Datum: 2026-03-28  
Branch: `codex`

## Ziel

Kleiner, reviewbarer Entflechtungsschritt im Regressions-Hotspot `hooks/useChatAIFlow.ts`, ohne Hook-Umbau:

- einen klaren pure-logic-Block fuer Builder-/Validator-Result-Normalisierung aus dem Hook ziehen
- die klarste Dopplung bei Result-Fallbacks reduzieren
- externen Chat-Flow-Vertrag (Plan/Builder/Validator/Status/Error) stabil lassen

## Umgesetzte Aenderungen

### 1) Neuer lokaler Pure-Helper `hooks/chatAIFlowResultHelpers.ts`

Neu eingefuehrt wurden zwei kleine pure Funktionen:

- `normalizeResultFiles(raw)`
  - kapselt `normalizeAiResponseDetailed(...)`
  - normalisiert fail-safe auf `{ files | null, parseError, responseText }`
  - trimmt parse-/response-Strings defensiv

- `readBuilderFilesOrThrow(normalizedResult, aiText)`
  - enthaelt den bisherigen Builder-Fallbackvertrag unveraendert:
    - bei fehlender Dateiliste + vorhandener Antwort: bestehender Fehlertext inkl. optionalem Normalizer-Hinweis + 900-Zeichen-Preview
    - bei komplett fehlender verwertbarer Antwort: bisheriger generischer Fehlertext

### 2) `useChatAIFlow.ts` bleibt Orchestrator, nutzt Helper

`useChatAIFlow` wurde nur minimal angepasst:

- Builder-Pfad nutzt jetzt `normalizeResultFiles(...)` + `readBuilderFilesOrThrow(...)` statt Inline-Mischblock
- Validator-Pfad nutzt fuer advisory-Dateiliste ebenfalls `normalizeResultFiles(...).files`

Bewusst unveraendert:

- Chat senden / Planner-/Builder-/Validator-Aufrufreihenfolge
- Error-/Fallback-Texte fuer Validator- und Explain-Warnungen
- Pending-Plan-/Pending-Change-/Status-/Loading-Semantik
- externer Hook-Vertrag

## Tests / Regressionen

Neu: `__tests__/chatAIFlowResultHelpers.test.ts`

Abgesichert werden gezielt die extrahierten Pure-Contracts:

1. gueltige Dateiliste wird unveraendert normalisiert
2. fehlende Dateiliste liefert weiterhin den Builder-Fehler mit Normalizer-Hinweis + gekuerzter Preview
3. komplett leere/irrelevante Antwort liefert weiterhin den bisherigen generischen Builder-Fehler

Zusatz-Regressionen (bestehend, weiterhin gruen):

- `__tests__/useChatAIFlow.validatorExplain.invariants.test.ts`
- `__tests__/useChatAIFlow.inputValidation.test.tsx`

## Checks

Ausgefuehrt:

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/chatAIFlowResultHelpers.test.ts __tests__/useChatAIFlow.validatorExplain.invariants.test.ts __tests__/useChatAIFlow.inputValidation.test.tsx`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`

## Restpunkte (bewusst unveraendert)

- `hooks/useChatAIFlow.ts` bleibt weiterhin ein grosser Misch-Hook.
- Dieser Patch extrahiert bewusst nur den kleinen Result-/Fallback-Block und loest nicht den gesamten Chat-Flow-Hotspot.
