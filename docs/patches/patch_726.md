# Patch 726 - Command-Intent mit Confidence und Grenzfall-Bestätigung

## Kontext

Der offene TODO-Punkt zur robusteren Intent-Erkennung sollte mit kleinem, sicherem Umfang umgesetzt werden: statt stiller Heuristik bei unklaren Inputs gibt es nun eine kurze explizite Bestätigung.

## Aenderungen

1. `utils/chatHeuristics.ts`:
   - neues `classifyChatIntent(...)` mit strukturiertem Ergebnis:
     - `intent` (`advice` | `builder` | `planner`)
     - `confidence`
     - `requiresConfirmation`
     - `reason`
2. `hooks/useChatAIFlow.ts`:
   - Planner-Routing nutzt nun `classifyChatIntent(...)`.
   - Bei `requiresConfirmation=true` wird eine kurze Chat-Rückfrage gezeigt (`planen` vs `direkt build`) inkl. transparenter Confidence/Reason.
3. `__tests__/chatHeuristics.plannerRouting.test.ts`:
   - neue Regressionen für
     - High-Confidence-Builder bei explizitem Datei-Task,
     - Grenzfall-Low-Signal mit Bestätigungsbedarf.
4. `docs/TODO.md`:
   - Command-Intent-Punkt als erledigt markiert (Patch 726),
   - aktive Restliste reduziert.

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/chatHeuristics.plannerRouting.test.ts`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
