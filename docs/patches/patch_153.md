# Patch 153

**Scope:** PR-5 Stage 2 (ProjectContext slimming)

## Goal
Move ZIP import/export + build trigger side-effects out of `contexts/ProjectContext.tsx` into focused services, while keeping behavior stable.

## Changes

### New
- `project/services/projectArchiveService.ts`
  - `exportProjectZip(project)`
  - `exportTextFilesZip(project)`
  - `importProjectZip()`
  - `cloneProjectWithOnlyTextFiles(project)` (keeps existing binary filtering rules)

- `project/services/buildStartService.ts`
  - `startBuildJob({ project, buildProfile })`
  - Includes best-effort GitHub push (same behavior as before) + calls `trigger-eas-build` via Supabase.

### Updated
- `contexts/ProjectContext.tsx`
  - ZIP export/import now delegates to `projectArchiveService`.
  - Build start now delegates to `buildStartService` for the GitHub push + Supabase trigger.
  - Polling logic remains in ProjectContext (handled in PR-3 already).

### Docs
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/refactor/REFACTORING_PLAN_V3.1_PATCHES.md`
- `PROJECT_CHECKLOG.md`

## Verification
Run:

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
