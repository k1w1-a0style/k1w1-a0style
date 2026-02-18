# Patch 184 — Hotfix Patch 183 (Typecheck/Lint)

## Why
Patch 183 introduced a few regressions that broke `npm run typecheck` and `npm run lint:ci` on the `work` branch.

## What changed
### TypeScript fixes
- `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts`
  - Reordered hook declarations so `runs` and `buildBlockedReason` are not referenced before initialization.
  - Removed duplicate build-precondition state declarations.
  - Moved `refreshPreconditions()` to the top section and wired it into pull-to-refresh dependencies.
- `screens/EnhancedBuildScreen/components/BuildStatusSection.tsx`
  - Added missing StyleSheet key `blockReason`.
- `screens/EnhancedBuildScreen/types.ts`
  - Added optional `run_number` on `WorkflowRun`.
- `screens/EnhancedBuildScreen/components/WorkflowRunDetailModal.tsx`
  - Guarded job URL opening so `onOpenUrl` never receives `null`/`undefined`.
- `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts`
  - History match now reads `branch` via safe casting to avoid type drift.
- `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
  - Fixed `setActiveBranch` usage (context setter does not accept functional updates).

### Lint fixes
- `screens/EnhancedBuildScreen/components/BuildHistorySection.tsx`
  - Switched to named imports from `expo-file-system` (`cacheDirectory`, `writeAsStringAsync`, `EncodingType`) to satisfy `import/namespace`.

## Files changed
- `screens/EnhancedBuildScreen/components/BuildStatusSection.tsx`
- `screens/EnhancedBuildScreen/components/BuildHistorySection.tsx`
- `screens/EnhancedBuildScreen/components/WorkflowRunDetailModal.tsx`
- `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts`
- `screens/EnhancedBuildScreen/types.ts`
- `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`

