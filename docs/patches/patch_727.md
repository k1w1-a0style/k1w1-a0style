# Patch 727 - Lokale/anonymisierte Qualitätsmetriken für Rückfragen

## Kontext

Der offene TODO-Punkt zu lokalen/anonymisierten Qualitätsmetriken sollte mit minimal-invasivem Scope umgesetzt werden: nur lokale Counter, keine Exfiltration.

## Aenderungen

1. `lib/chatQualityMetrics.ts` (neu):
   - AsyncStorage-basierte Snapshot-Counter für Intent-Bestätigungen:
     - `intent_confirmation_prompt`
     - `intent_confirmation_planen`
     - `intent_confirmation_build`
2. `lib/storageKeys.ts`:
   - neuer Key `CHAT_QUALITY_METRICS`.
3. `hooks/useChatAIFlow.ts`:
   - bei Low-Signal-Confirmation-Prompt wird `intent_confirmation_prompt` gezählt.
   - wenn User `planen` oder `direkt build` antwortet, werden die jeweiligen Counter gezählt.
4. Tests:
   - neues `lib/__tests__/chatQualityMetrics.test.ts` (Counter + malformed-JSON-Resilienz).
5. `docs/TODO.md`:
   - Qualitätsmetriken-Punkt als erledigt markiert (Patch 727),
   - verbleibender aktiver Restpunkt reduziert.

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand lib/__tests__/chatQualityMetrics.test.ts __tests__/chatHeuristics.plannerRouting.test.ts`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
