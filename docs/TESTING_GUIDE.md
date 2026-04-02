# Testing Guide

Stand: **2026-04-02 (Docs Konsolidierung)**

## Kanonischer lokaler Ablauf

```bash
npm ci
npm run typecheck
npm run typecheck:edge
npm run typecheck:strict
npm run lint:ci
npm run test:silent
```

Optional:

```bash
npm run test:e2e:smoke
npm run verify:release (inkl. App-Typecheck nur, wenn `node_modules/expo/tsconfig.base.json` vorhanden ist)
```

## Read-only Live-/Staging-Checks

```bash
EDGE_BASE_URL="https://<project>.supabase.co/functions/v1" EDGE_OPERATOR_JWT="<extern provisionierter build_admin JWT>" npm run edge:check:live
```

Oder als kompletter Verify-Pfad:

```bash
EDGE_BASE_URL="https://<project>.supabase.co/functions/v1" EDGE_OPERATOR_JWT="<extern provisionierter build_admin JWT>" npm run verify:release
```

## Zweck

- lokale Verifikation reproduzierbar halten
- Edge-/Docs-/Contract-Checks nicht von Hauptsuite entkoppeln
- Read-only Live-Checks klar von produktiven Mutationen trennen

## Verweise

- `docs/FRESH_CHECKOUT_GREEN_PATH.md`
- `docs/04-testing-smoke-plan.md`
- `docs/08-test-coverage-matrix.md`
