# Patch 236 — Hotfix: broken import block in WorkflowRunDetailModal

## Why
Patch 235 accidentally introduced a malformed `import type { ... }` block inside
`screens/EnhancedBuildScreen/components/WorkflowRunDetailModal.tsx`, which breaks:

- `npm run test:silent` (Jest parse error)
- `npm run typecheck` (TS1003/1005 etc.)

## What changed
- Fix import section ordering (no nested `import` inside `import type { ... }`).
- Use `logger.info(...)` instead of `console.log(...)` for clipboard feedback.

## Files
- `screens/EnhancedBuildScreen/components/WorkflowRunDetailModal.tsx`
- `docs/patches/patch_236.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `PROJECT_CHECKLOG.md`
