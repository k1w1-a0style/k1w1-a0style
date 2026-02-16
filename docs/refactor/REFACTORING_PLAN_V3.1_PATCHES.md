# Refactoring Plan V3.1 (Patch-oriented)

This is a patchable version of the Refactoring Plan V3, adjusted to avoid duplicate implementations.

## PR-0: Baseline & guardrails
- Capture baseline outputs (typecheck/lint/tests)
- Add helper scripts

## PR-1: Shared types + transitional approach
- Add `shared/types/*` as the future source-of-truth
- Keep current code working (no behavior changes in this PR)

## PR-2: Storage consolidation (NO rewrite)
- Move `contexts/projectStorage.ts` to `infra/storage/projectPersistence.ts`
- Keep `contexts/projectStorage.ts` as a facade re-export
  - ✅ Implemented by Patch 148

## PR-3: Polling consolidation (NO parallel poller)
- Extract pure polling functions into `project/services/buildPollingService.ts`
- Keep `hooks/useBuildStatus.ts` as the single hook and call the service
  - ✅ Implemented by Patch 149

## PR-4: GitHub infra split
- Create `infra/github/*`
- Keep `contexts/githubService.ts` as facade until all callers migrated
  - ✅ PR-4 stage 1 implemented by Patch 150 (move + facade)
  - ✅ PR-4 stage 2 implemented by Patch 151 (split into modules; barrel exports)

## PR-5: ProjectContext slimming
- Move pure domain logic into `project/domain/*`
- Side-effects into `project/services/*`
  - ✅ PR-5 stage 1 implemented by Patch 152 (template loader + file mutations)
  - ✅ PR-5 stage 2 implemented by Patch 153 (archive + build trigger services)

## PR-6: Diagnostics + templateChecklist split
- Split `lib/templateChecklist.ts` into smaller check modules under `lib/diagnostics/templates/*`
- Keep old entrypoint as facade if needed

## PR-7+: Quality / cleanup
- Remove facades when no longer used
- Tighten lint rules
- Keep docs + changelog updated


## Patch 150
- PR-4 stage 1: Move `contexts/githubService.ts` → `infra/github/githubService.ts` + keep `contexts/githubService.ts` as facade.

## Patch 151
- PR-4 stage 2: Split `infra/github/githubService.ts` into focused modules (`tokenStore`, `repos`, `files`, `secrets`, `workflows`, plus shared helpers).
- Keep the public API stable through re-exports.

## Patch 152
- PR-5 stage 1: Extract template loading (`project/services/templateLoader.ts`) and pure file update helpers (`project/domain/projectFileMutations.ts`) out of `contexts/ProjectContext.tsx`.
- Keep behavior stable; ProjectContext remains the single state/persistence coordinator.

## Patch 153
- PR-5 stage 2: Extract ZIP import/export helpers (`project/services/projectArchiveService.ts`) and build trigger orchestration (`project/services/buildStartService.ts`) out of `contexts/ProjectContext.tsx`.
- Keep behavior stable; ProjectContext still owns build polling + state.

