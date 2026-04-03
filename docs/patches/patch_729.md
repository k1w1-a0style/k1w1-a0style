# Patch 729 - Scout-Mode-PendingPlan-Invariant abgesichert

## Kontext

Nach Einführung des Scout-/Audit-only-Modus soll regressionssicher bleiben, dass ohne explizites `direkt build` keine automatische Builder-Weiterführung stattfindet.

## Aenderungen

1. `__tests__/useChatAIFlow.pendingPlan.guard.invariants.test.ts`:
   - neuer Invariant-Check auf Scout-Guard:
     - `if (currentPlan.mode === "scout" && !wantsDirectBuild)`
     - `lower === "direkt build"`
     - sichtbarer Scout-Hinweistext (`Scout-Modus aktiv`)
2. Keine Runtime-Logik geändert (reiner Regression-Schutz).

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/useChatAIFlow.pendingPlan.guard.invariants.test.ts`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
