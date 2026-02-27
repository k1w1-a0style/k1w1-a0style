# Patch 292

## Summary
Fix a TypeScript **typecheck** regression introduced in Patch 291 where `refreshSyncStatus` was referenced in dependency arrays before its declaration (TDZ / block-scope order).

## Changes
- **RepoScreen hook:** Move `refreshSyncStatus` above callbacks that depend on it.
- No runtime/UX behavior changes intended; this is a compile-time fix only.

## Files changed
- `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_292.md`
