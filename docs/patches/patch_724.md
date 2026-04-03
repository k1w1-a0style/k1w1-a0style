# Patch 724 - Planner-Rückfragen als strukturierte Slot-Liste

## Kontext

Der offene TODO-Punkt zu strukturierten Planner-Rückfragen sollte abgeschlossen werden: Rückfragen sollen nicht als freier Fließtext kommen, sondern in einem klaren Slot-Format.

## Aenderungen

1. `lib/promptEngine.ts`:
   - Planner-Regel #1 fordert Rückfragen jetzt explizit als strukturierte Slot-Liste im Format
     `"[SLOT] <Name>: <Frage>"`.
2. `__tests__/promptEngine.contextPriority.test.ts`:
   - neue Regression prüft den Planner-Systemprompt auf die Slot-Format-Instruktion.
3. `docs/TODO.md`:
   - Punkt "Planer-Rückfragen strukturiert ..." als erledigt markiert (Patch 724).

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/promptEngine.contextPriority.test.ts`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
