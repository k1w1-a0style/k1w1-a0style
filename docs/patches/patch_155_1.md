# Patch 155.1 — PR-6 Stage 1 hotfix

This patch fixes TypeScript regressions introduced by Patch 155.

## Fixes

1) **Toolchain typing**
- `DEFAULT_TOOLCHAIN` is now typed via a shared `Toolchain` type.
- `patchPackageJson(...)` accepts `Toolchain` (string versions), so merging overrides doesn't break the type system.

2) **Missing `TemplateFileMap` type**
- Re-introduced as an exported type in `lib/diagnostics/templates/templateChecklistTypes.ts`.
- `lib/templateChecklist.ts` imports and uses it for helper functions.

## Files changed

- `lib/diagnostics/templates/toolchain.ts`
- `lib/diagnostics/templates/templateChecklistTypes.ts`
- `lib/templateChecklist.ts`
- `docs/patches/patch_155_1.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/refactor/REFACTORING_PLAN_V3.1_PATCHES.md`
- `PROJECT_CHECKLOG.md`
