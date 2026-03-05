# Patch 358: fix CI Lite Autofix template duplicate key (TS1117)

## Problem
`infra/github/workflowTemplates.ts` contained **two** object keys named `k1w1-ci-lite-autofix.yml`.
TypeScript rejects this with **TS1117** (“object literal cannot have multiple properties with the same name”), so your `git add -A && npm run typecheck ...` commit chain breaks.

## Fix
- Removed the **duplicate** `k1w1-ci-lite-autofix.yml` template entry.
- Kept the intended Autofix workflow template (the one that runs `eslint . --fix` and commits/pushes if needed).

## Files changed
- `infra/github/workflowTemplates.ts`
- `docs/patches/patch_358.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `PROJECT_CHECKLOG.md`
