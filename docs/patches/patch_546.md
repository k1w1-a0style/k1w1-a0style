# Patch 546

## Titel
Workflow-Lint-CI-Fehler reproduziert und finaler Anti-Flaky-Guard fuer Jest nachgeschaerft.

## Root Cause
- Der rote GitHub-Actions-Lauf auf PR #407 war **kein** erneuter Testflake in `npm run test:silent`.
- Laut Checks/Annotations scheiterte `Workflow Lint (dry)` im Schritt `Run workflow guard scripts` mit `Process completed with exit code 1`.
- Lokal reproduzierbar war der konkrete Fehler in `bash scripts/check_patch_docs_sync.sh`: `PROJECT_CHECKLOG.md top patch (545) does not match README patch 544`.
- Ursache war also ein Docs-Sync-Drift zwischen `README.md` und den bereits auf Patch 545 aktualisierten Patch-Logs.

## Was wurde geaendert?
- `README.md` wurde auf Patch 546 gezogen, damit README, `PROJECT_CHECKLOG.md`, `docs/patches/PATCHLOG_ROOT.md` und die neue Patch-Notiz wieder denselben Top-Patch melden.
- `jest.setup.js` haelt den bestehenden Netzwerk-/Timer-/Cleanup-Guard bei und faengt zusaetzlich `unhandledRejection` pro Test als Fail-fast-Fehler ab.
- Keine Produktlogik, keine Timeouterhoehung, kein `runInBand`, keine abgeschwaechten Assertions.

## Validierung
- `bash scripts/check_workflow_template_drift.sh` ✅
- `bash scripts/check_managed_workflows.sh` ✅
- `bash scripts/check_workflow_edge_contracts.sh` ✅
- `bash scripts/check_legacy_disabled_edges.sh` ✅
- `bash scripts/check_patch_docs_sync.sh` ✅
- `npm run test:silent` (Run 1) ✅
- `npm run test:silent` (Run 2) ✅
- `npm run test:silent` (Run 3) ✅
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `git diff --check` ✅

## CI-Status
- Die **vorher rote** GitHub-Actions-Ursache ist damit lokal exakt reproduziert und behoben.
- Ein neuer Remote-CI-Lauf kann aus dieser Umgebung nicht selbst gestartet werden; deshalb behauptet diese Notiz **nicht**, dass GitHub Actions bereits erneut gelaufen ist.
