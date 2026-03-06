# Patch 389 - workflow template drift check + strict CI-Lite branch dispatch

## Goal
Address the last notable workflow/process gaps after patches 386-388:
- remove the remaining branch fallback in header-driven CI-Lite dispatch
- strengthen drift detection for managed embedded workflow templates

## Changes
- `useCiLiteWorkflow.ts` now blocks dispatch when no linked branch is set.
- Added `scripts/check_workflow_template_drift.sh`.
- Embedded CI-lite templates are checked for:
  - managed markers
  - consistent workflow version
  - pinned actions/checkout
  - pinned actions/setup-node
  - pinned actions/upload-artifact
  - source_commit_sha backchannel
- Updated `AGENTS.md` to require the new drift validator.
- Added a small invariant to ensure no default-branch fallback remains in the CI-Lite header hook.

## Notes
This patch intentionally makes CI-Lite dispatch stricter:
no selected branch = no dispatch.
