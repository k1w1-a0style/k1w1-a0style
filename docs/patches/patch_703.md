# Patch 703 - Concurrency-Stress fuer EAS Link Status Request Guard (Durchlauf 13)

Datum: 2026-04-02

## Kontext
Im Durchlauf 13 war das Ziel, Race-/Stale-Kanten ohne Produktionsumbau gezielt regressionssicher zu testen. Der `easLinkStatusRequestGuard` ist ein zentraler Guard fuer stale/overlapping Status-Requests im Repo-/Branch-Kontext.

## Befund
- Basistests fuer stale/newer/invalidate/context-missing existierten bereits.
- Ein laengerer gemischter Operationslauf (begin/setContext/invalidate) mit Modellabgleich fehlte noch.

## Fix
- Neue Stress-Regression `__tests__/githubReposScreen.easLinkStatusRequestGuard.stress.test.ts`:
  - 200 gemischte Operationen mit deterministischem seeded RNG,
  - Modellabgleich fuer `requestId` nach jedem Schritt,
  - Endzustandspruefung fuer `isCurrent(token)` gegen den Modellzustand.
- Keine Produktionslogik geaendert; rein testseitige Haertung.

## Validierung
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/githubReposScreen.easLinkStatusRequestGuard.stress.test.ts`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
