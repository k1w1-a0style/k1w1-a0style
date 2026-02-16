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

## PR-3: Polling consolidation (NO parallel poller)
- Extract pure polling functions into `project/services/buildPollingService.ts`
- Keep `hooks/useBuildStatus.ts` as the single hook and call the service

## PR-4: GitHub infra split
- Create `infra/github/*`
- Keep `contexts/githubService.ts` as facade until all callers migrated

## PR-5: ProjectContext slimming
- Move pure domain logic into `project/domain/*`
- Side-effects into `project/services/*`

## PR-6: Diagnostics + templateChecklist split
- Split `lib/templateChecklist.ts` into smaller check modules under `lib/diagnostics/templates/*`
- Keep old entrypoint as facade if needed

## PR-7+: Quality / cleanup
- Remove facades when no longer used
- Tighten lint rules
- Keep docs + changelog updated
