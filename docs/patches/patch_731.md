# Patch 731 - Abschlussrunde: Invariant-Hardening + 10er-Durchlauf-Roadmap

## Kontext

Für die letzte Runde sollten (a) ein weiterer kleiner, sicherer Hardening-Schritt und (b) eine klare Empfehlungsliste für die nächsten Durchläufe dokumentiert werden.

## Aenderungen

1. `__tests__/useChatAIFlow.pendingPlan.guard.invariants.test.ts`:
   - neuer Check: `isDirectBuildCommand(...)` wird sowohl im Metrics-Pfad als auch im Scout-Handoff genutzt.
2. `docs/TODO.md`:
   - Abschnitt "Was sind Durchläufe?" ergänzt (nicht nur Tests, sondern Mini-Zyklus aus Umsetzung + Verifikation + Doku-Sync).
   - neue priorisierte Liste mit 10 empfohlenen nächsten Durchläufen ergänzt.

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/useChatAIFlow.pendingPlan.guard.invariants.test.ts`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
