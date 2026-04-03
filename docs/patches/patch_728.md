# Patch 728 - Scout-/Audit-only-Modus im Chat-Flow

## Kontext

Der letzte offene aktive TODO-Punkt war ein expliziter Großprojekt-/Scout-Modus ohne automatische Builder-Phase.

## Aenderungen

1. `utils/chatHeuristics.ts`:
   - neuer Helper `looksLikeScoutModeRequest(...)` erkennt Scout-/Audit-only-Intents.
2. `hooks/useChatAIFlow.ts`:
   - bei Scout-Intents wird der Pending-Plan als `mode: "scout"` geführt.
   - solange Scout aktiv ist, bleibt der Flow im Analyse/Plan-Modus.
   - für den Wechsel in Umsetzung ist jetzt eine explizite User-Bestätigung `direkt build` nötig.
3. `hooks/chatAIFlowTypes.ts`:
   - `PendingPlan.mode` erweitert um `"scout"`.
4. `__tests__/chatHeuristics.plannerRouting.test.ts`:
   - neue Regression für Scout-/Audit-only-Erkennung.
5. `docs/TODO.md`:
   - Scout-Modus-Punkt als erledigt markiert (Patch 728),
   - aktive Restliste auf „keine offenen Punkte“ gesetzt.

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/chatHeuristics.plannerRouting.test.ts`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
