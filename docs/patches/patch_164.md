# Patch 164: PR-7 Stage 5 — Facade removal

## Summary
Removed legacy facade re-export entrypoints after all imports were migrated to the new locations.

## Removed
- `contexts/githubService.ts` (facade) → use `infra/github/githubService`
- `contexts/projectStorage.ts` (facade) → use `infra/storage/projectPersistence`
- `lib/templateChecklist.ts` (facade) → use `lib/diagnostics/templates`

## Fixes
- Updated `contexts/ProjectContext.tsx` to import GitHub functions from `infra/github/githubService` (was `./githubService`).

## Verification
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `bash scripts/refactor/pr7-facade-audit.sh` (no facade imports found)
