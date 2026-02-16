# Patch 150 — GitHub service moved to infra (PR-4 stage 1)

Date: 2026-02-16

## Goal
Reduce coupling between React contexts and infrastructure code by moving the GitHub integration out of `contexts/`.

This is the first step of **PR-4 (GitHub infra split + facade)** from Refactoring Plan V3.1.

## Changes
- **Moved** GitHub integration implementation from `contexts/githubService.ts` to `infra/github/githubService.ts`.
- `contexts/githubService.ts` is now a **facade re-export**, preserving all existing imports and behavior.
- Updated internal imports to use:
  - `shared/types/project` for `ProjectFile`
  - `lib/RateLimiter` via the new relative path

## Compatibility
- No runtime behavior changes intended.
- All existing call sites that import from `contexts/githubService` continue to work.

## Verification
Run:
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

All must be green before commit/push.
