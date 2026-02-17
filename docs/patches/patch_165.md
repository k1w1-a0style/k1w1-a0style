# Patch 165: PR-7 Stage 5 hotfix — refactor scripts + docs formatting

## Summary
Follow-up to Patch 164.

## Changes
- Fixed `docs/patches/patch_164.md` formatting (was garbled due to a broken heredoc).
- Updated refactor helper scripts to tolerate facade removal:
  - `scripts/refactor/pr4-github-infra.sh`
  - `scripts/refactor/pr2-storage-move.sh`

## Verification
- `bash scripts/refactor/pr4-github-infra.sh`
- `bash scripts/refactor/pr2-storage-move.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
