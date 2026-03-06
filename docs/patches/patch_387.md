# Patch 387 - managed workflow drift hardening + CI-lite template SHA metadata + cleanup

## Goal
Tighten managed workflow handling after patch 386:
- managed templates should identify themselves consistently
- CI-lite/autofix artifacts should include the checked-out commit SHA
- bootstrap logic should understand managed workflow metadata
- temporary patch-helper files should not live in the product repo

## Changes
- Removed accidental helper files `apply_patch_386_direct.sh` and `apply_patch_387_direct.sh` from repo root.
- Added managed markers to the embedded CI-lite workflow templates in `github-workflow-dispatch`.
- Added `source_commit_sha` to CI-lite and CI-lite-autofix result artifacts.
- Added helper functions to parse managed workflow metadata from existing workflow files.
- `ensureWorkflowFileExists(...)` now reports current managed metadata for better drift diagnostics.
- Added invariant tests to lock in managed markers + template SHA fields.

## Notes
This patch improves workflow self-description and future drift handling.
It does not change build gating rules from patch 386.
