# Patch 725 - Guard-Policy-Hinweis vor Vorschlägen im Planner-Reply

## Kontext

Der offene TODO-Punkt zur Sichtbarkeit der Guard-Policy bereits vor Vorschlägen sollte abgeschlossen werden, damit Nutzer schon vor der eigentlichen Dateiliste klar sehen, was automatisch vorschlagbar ist und was manuell bleibt.

## Aenderungen

1. `hooks/useChatAIFlow.ts`:
   - neuer Helper `buildGuardPolicyPreHint()`.
   - Planner-Assistenznachricht zeigt den Guard-Policy-Block (`allowed`/`guarded`) jetzt vor dem Plantext.
2. `__tests__/useChatAIFlow.summary.regression.test.ts`:
   - neue Regression prüft die Guard-Policy-Hint-Copy.
3. `docs/TODO.md`:
   - Guard-Policy-Punkt als erledigt markiert (Patch 725).
   - verbleibende offenen Produktpunkte als aktive Restliste für nächste PR-Branches explizit verdichtet.

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/useChatAIFlow.summary.regression.test.ts`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
