# Patch 388 - workflow drift validator + stronger patch artifact discipline

## Goal
Finish the workflow/process hardening line after patches 386 and 387.

## Changes
- Added `scripts/check_managed_workflows.sh`.
- Strengthened `scripts/check_patch_artifact.sh`:
  - verifies patchlog/checklog references
  - requires a patch note file reference
  - rejects helper scripts like `apply_patch_*_direct.sh`
  - rejects `.rej` / `.orig` leftovers
- Updated `AGENTS.md` to require both validators before shipping a patch artifact.

## Notes
This patch does not change runtime app behavior.
It hardens the maintenance process around managed workflows and patch delivery.
