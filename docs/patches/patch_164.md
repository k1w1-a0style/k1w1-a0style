# Patch 164: PR-7 Stage 5 — Facade removal

## Summary
All legacy *facade* entrypoints (thin re-export files kept for backward compatibility) were removed after the codebase was fully migrated to the new module locations.

## Removed
- `contexts/githubService.ts` (facade) → import from `infra/github/githubService`
- `contexts/projectStorage.ts` (facade) → import from `infra/storage/projectPersistence`
- `lib/templateChecklist.ts` (facade) → import from `lib/diagnostics/templates`

## Fixes
- Updated `contexts/ProjectContext.tsx` to import GitHub helpers from `infra/github/githubService` (was `./githubService`).

## Verification
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `bash scripts/refactor/pr7-facade-audit.sh` (should report no facade imports)
