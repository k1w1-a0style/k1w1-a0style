# Patch 704 - Security-Negativtest-Welle fuer requireScopedEdgeAuth (Durchlauf 14)

Datum: 2026-04-02

## Kontext
Fuer Durchlauf 14 sollte die Edge/Auth-Haertung nicht nur per Invariant-Strings, sondern auch mit direktem Runtime-Verhaltenstest abgesichert werden.

## Befund
- Viele Invariant-Checks pruefen Contract-Texte robust, aber ein direkter behavior-Test fuer `requireScopedEdgeAuth(...)` fehlte in dieser Tiefe.

## Fix
- Neue Runtime-Regression `__tests__/edgeAuth.scopedGuard.behavior.test.ts` fuer `_shared/auth`:
  - fail-closed bei fehlender Route-Secret-Config (500),
  - 401 bei malformed Authorization Header,
  - 401 bei gemischtem admin+bearer wenn Dual-Mode aus ist,
  - 401 bei bearer-only auf scoped-admin Route,
  - success (`null`) bei gueltigem scoped admin key.
- Produktionscode unveraendert; nur Testabdeckung erweitert.

## Validierung
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/edgeAuth.scopedGuard.behavior.test.ts`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
