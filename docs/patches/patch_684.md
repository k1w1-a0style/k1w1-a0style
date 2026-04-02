# Patch 684 — diagnostic / patch / invariant test debt cleanup

## Ziel

Den naechsten fokussierten Test-/Fixture-Block helper-first bereinigen, ohne Produktcode oder Vertrage zu aendern.

## Umgesetzt

- `__tests__/diagnosticFixResultContract.test.ts` nutzt jetzt `makePreflightResult(...)` / `makePreflightPatch(...)` statt lokaler `as any`-Fixtures.
- `__tests__/preflight.lockfileConsistency.test.ts` arbeitet mit getypten `ProjectFile`-Fixtures ueber `makeProjectFile(...)`.
- `__tests__/repoSyncOrchestration.test.ts` nutzt helper-first `ProjectFile`-Fixtures statt lokaler `as any`-Arrays.
- `lib/__tests__/fileWriter.test.ts` liest Ergebnisdateien ueber `findProjectFile(...)` statt `find((f: any) => ...)`.
- `__tests__/helpers/projectTestHelpers.ts` exportiert jetzt zusaetzlich `findProjectFile(...)`.

## Verifikation

- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`

## Ergebnis

Der produktive Code bleibt unveraendert; der helper-first Test-/Fixture-Debt im Diagnostic-/Patch-/Invariant-Cluster ist weiter reduziert.
