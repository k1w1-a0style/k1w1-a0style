# Patch 723 - Sichtbarer Kontextkürzungs-Hinweis im Chat-Flow

## Kontext

Der offene TODO-Punkt zum sichtbaren Hinweis bei `aiContextBudget`-Kürzungen sollte umgesetzt werden, damit Nutzer direkt im Chat sehen, wenn der Prompt-Kontext reduziert wurde.

## Aenderungen

1. `hooks/useChatAIFlow.ts`:
   - neuer Helper `extractContextBudgetNotice(...)` erkennt den internen Prompt-Marker `[intern] Kontext gekürzt (...)`.
   - neuer Chat-Hinweis `🏷️ **Kontext gekürzt:** ...` wird einmalig (dedupliziert) als System-Message angezeigt.
   - Hook-Plumbing ruft den Hinweis sowohl im Planner- als auch im Builder-Zweig auf.
2. `shared/types/chat.ts`:
   - neues optionales Meta-Flag `contextBudgetNote?: boolean`.
3. `__tests__/useChatAIFlow.summary.regression.test.ts`:
   - neue Regressionen für Marker-Extraktion + No-Marker-Fall.
4. `docs/TODO.md`:
   - Kontextkürzungs-Badge-Punkt als erledigt markiert (Patch 723).

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/useChatAIFlow.summary.regression.test.ts`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
