# Patch 403

Date: 2026-03-08

## Scope
- make EAS Build package-manager handling honest across live and embedded workflow sources
- fix deploy-supabase concurrency to use the effective target ref
- pass `autofix` and `strict_lockfile` through `repository_dispatch` in triggered builds
- repair malformed indentation/step structure in `eas-build.yml`

## Files
- `.github/workflows/eas-build.yml`
- `.github/workflows/deploy-supabase-functions.yml`
- `.github/workflows/k1w1-triggered-build.yml`
- `README.md`
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `lib/diagnostics/workflowTemplates.ts`
- `scripts/check_workflow_template_drift.sh`
- `__tests__/patch403.workflowContracts.invariants.test.ts`

## Notes
This patch keeps the repo npm-first but removes false lockfile signals, repairs malformed EAS YAML structure, and syncs the embedded diagnostics workflow sources so later regeneration/bootstrap paths cannot reintroduce the old behavior.


## v4 additions
- CI Lite live workflows and bootstrap templates now detect npm / yarn / pnpm and install accordingly.
- Drift guard now asserts package-manager-aware CI Lite parity across live + infra + edge sources.


## v5 refinement
- Makes EAS autofix/writeback path explicit npm-only, so yarn/pnpm repos are no longer “half-supported” during autofix.
- Keeps package-manager-aware install/caching paths from v4, but prevents npm-specific lockfile writeback from running on non-npm repos.
- Extends guard coverage for the non-npm autofix notice in live workflow + diagnostics template source.
