# Patch 166: PR-8 kickoff — post-PR-7 verification & cleanup

## Summary
This patch is a small “sanity + hygiene” step after PR-7 Stage 5 (facade removal). It tightens the verification script so we don't repeat the same failure mode (relative imports that the old audit didn't catch), and it aligns docs/checklogs with the current reality.

## Changes
- Harden `scripts/refactor/pr7-facade-audit.sh`:
  - Verifies the removed facade files are actually **gone**.
  - Also scans for common **relative import** leftovers (e.g. `from "./githubService"`) that can slip past a facade-name audit.
  - Keeps the existing “no `contexts/*` / `lib/templateChecklist` imports” checks.
- Docs/checklog alignment:
  - Update `docs/patches/PATCHLOG_ROOT.md` to include patches 164–166.
  - Update `PROJECT_CHECKLOG.md` to record patches 164–166.
  - Update `docs/refactor/REFACTORING_PLAN_V3.1_PATCHES.md` to mark PR-7 complete and note PR-8 kickoff.

## Verification
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `bash scripts/refactor/pr7-facade-audit.sh`
