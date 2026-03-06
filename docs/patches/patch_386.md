# Patch 386 - SHA hardening phase 2 + workflow marker completion + patch artifact discipline

## Goal
Harden the remaining weak points after patches 381-385:
- CI Lite must be tied not only to repo/branch, but also to the exact branch HEAD SHA.
- Managed workflow metadata should be more explicit.
- Patch delivery should follow one canonical `.patch` workflow instead of mixed overlay/zip habits.

## Changes
- Added `CI_LITE_LAST_SHA` storage key.
- CI Lite persistence now stores the exact checked commit SHA (`artifact source_commit_sha` or workflow `head_sha` fallback).
- Build readiness now compares the current branch HEAD SHA with the last green CI Lite SHA and blocks mismatches.
- Added `getBranchHeadSha(owner, repo, branch)` to GitHub branch helpers.
- Added managed markers to `eas-link.yml`.
- Updated `AGENTS.md` to the canonical `.patch` + `git apply` workflow.
- Added `scripts/check_patch_artifact.sh` as a lightweight artifact validator.
- Updated integration tests for the new SHA gate.

## Notes
This patch intentionally tightens build gating.
After applying it, CI Lite may need to be rerun once for the currently selected repo/branch so the SHA cache is populated.
