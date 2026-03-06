# Patch 385 - Project-context SoT correction + CI Lite artifact/autofix hardening

## Goal
Tighten the remaining regressions after patches 381-384 so the builder consistently treats `linkedRepo` + `linkedBranch` as the active project target.

## Changes
- Build screen now reads repo/branch only from `projectData.linkedRepo` and `projectData.linkedBranch`.
- Build-screen log fetches no longer fall back to `currentBuild.githubRepo`.
- Checklist memo now reacts to `ciLiteReason` and `ciLiteStale`.
- Header CI-Lite hook now reads repo/branch only from project context.
- `computeCiLiteOk(...)` now receives deterministic artifact result fields from the CI-Lite artifact.
- Added one guarded auto-chain: a manually started CI-Lite failure may trigger one Autofix cycle, but only once per manual CI-Lite session.
- Added invariant tests to lock in the stricter source-of-truth rule.

## Notes
