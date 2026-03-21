# Patch 528 — CI-Lite-/Build-Readiness-Contracts klein konsolidiert

## Ziel

Nach den letzten CI-Lite-/Build-Readiness-PRs bleibt ein kleiner, rein stabilitaetsorientierter
Cleanup: keine neue Architektur, kein Verhaltenswechsel, aber weniger Drift bei Reason-Strings,
kleinere Test-Ueberlappungen und klarere Source-of-Truth an den Randtypen.

## Umsetzung

1. `lib/ciLitePersistence.ts`
   - gemeinsamer `CI_LITE_WORKFLOW_ID` statt mehrfacher Inline-Strings
   - neue `CI_LITE_PERSISTENCE_REASONS` als kleine kanonische Source of Truth fuer
     Persistenz-/Validierungsgruende
   - `PersistedCiLiteSelectionCheck.reason` ist jetzt auf diese bekannten Gruende typisiert
2. `lib/buildReadiness.ts`
   - Readiness-Mapping nutzt dieselben kanonischen CI-Lite-Reason-Konstanten statt eine verstreute
     Reihe harter Stringvergleiche
   - Invalid-Snapshot-Faelle bleiben unveraendert, sind aber gebuendelt lesbarer zugeordnet
3. Tests
   - `__tests__/ciLitePersistence.test.ts` nutzt dieselben kanonischen Reason-/Workflow-Konstanten
     und fasst die fast identischen Repo-/Branch-Mismatch-Faelle in `it.each(...)` zusammen
   - `__tests__/buildReadinessContract.test.ts` nutzt denselben Cleanup-Ansatz fuer die zwei
     eng verwandten CI-Lite-Blockerfaelle (stale / SHA-Mismatch)

## Tests / Checks

- `npm run test:silent -- --runInBand __tests__/ciLitePersistence.test.ts __tests__/buildReadinessContract.test.ts __tests__/buildReadinessState.test.ts __tests__/buildStartService.readinessContract.test.ts`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`

## Risiko / Scope

- Kein funktionaler Eingriff in CI-Lite-Dispatch, Persistenzverhalten, Build-Readiness oder
  EAS-/Push-/Sync-Logik.
- Keine neue Abstraktionsschicht; nur kleine kanonische Konstanten fuer bereits bestehende
  Vertragsanliegen.
- UI-Texte bleiben fachlich unveraendert; vereinheitlicht wurde nur die interne Source of Truth.
