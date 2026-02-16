# Patch 152 — PR-5 (Stage 1): ProjectContext slimming (template + file mutations)

Date: 2026-02-16

## Goal
Reduce the size and responsibility of `contexts/ProjectContext.tsx` without changing behavior.

This patch extracts:
- **Template loading/catalog** → `project/services/templateLoader.ts`
- **Pure file mutation logic** → `project/domain/projectFileMutations.ts`

`ProjectContext` keeps:
- State management + mutex
- Persistence calls
- UI-facing logging/alerts

## Changes
### New
- `project/services/templateLoader.ts`
  - `loadTemplateFromFile(templateId)`
  - `TEMPLATE_CATALOG` (for UI template picker)
- `project/domain/projectFileMutations.ts`
  - `mergeProjectFiles(existing, updates)`
  - `applyProjectFileUpdates(prev, files, newName?)`

### Updated
- `contexts/ProjectContext.tsx`
  - removed inline `loadTemplateFromFile` and `TEMPLATE_CATALOG`
  - uses `templateLoader` exports instead
  - `updateProjectFiles` now delegates merging + update to `projectFileMutations`

### Docs
- `docs/patches/PATCHLOG_ROOT.md`
- `PROJECT_CHECKLOG.md`
- `docs/refactor/REFACTORING_PLAN_V3.1_PATCHES.md`

## Verification
Run:
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

Expected: all green.

## Notes
No intended runtime behavior changes.
