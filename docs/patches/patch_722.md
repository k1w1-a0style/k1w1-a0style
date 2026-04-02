# Patch 722 - Strukturierte Pre-Flight-Zusammenfassung vor Datei-Review

## Kontext

Der offene TODO-Punkt "Strukturierte Pre-Flight-Zusammenfassung vor Builder-Start" sollte sichtbar im Chat-Flow ankommen, damit Nutzer vor der Dateiliste klar sehen, was voraussichtlich automatisch geaendert wird und was manuell bleibt.

## Aenderungen

1. Neues Helper-Export in `hooks/useChatAIFlow.ts`:
   - `buildPreflightSummaryIntro()` liefert den expliziten Intro-Block
   - Text nennt transparent beide Seiten: `neu/aktualisiert` und `manuell bleiben`
2. Der Intro-Block wird in `summaryText` direkt vor der finalen Dateiliste eingeblendet.
3. Regression `__tests__/useChatAIFlow.summary.regression.test.ts` wurde erweitert:
   - neuer Test auf die feste Intro-Copy inklusive zentraler Begriffe.
4. `docs/TODO.md` markiert den Punkt als erledigt (Patch 722).

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/useChatAIFlow.summary.regression.test.ts`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
