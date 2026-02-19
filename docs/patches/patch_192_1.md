# Patch 192.1 — Hotfix: One-Click Deploy Jest mock paths

## Why
The new `__tests__/oneClickDeploy.test.tsx` mocked modules using the hook's *relative* import strings (e.g. `../../../contexts/...`).
In Jest, those relative module ids are resolved from the **test file**, so the resolver looked in the wrong place and crashed with:

- `Cannot find module '../../../contexts/ProjectContext' from '__tests__/oneClickDeploy.test.tsx'`

## What changed
- Updated the test to mock the same **resolved module files** using paths relative to the test file:
  - `../contexts/ProjectContext`
  - `../infra/github/githubService`
  - `../lib/autoSyncRepoSecrets`

## Files changed
- `__tests__/oneClickDeploy.test.tsx`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_192_1.md`
- `PROJECT_CHECKLOG.md`
