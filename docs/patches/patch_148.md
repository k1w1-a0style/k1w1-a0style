# Patch 148 (V3.1 PR-2: Storage move + facade)

## Goal
Eliminate duplicate persistence implementations by **moving** the existing storage/ZIP logic out of `contexts/`
into a dedicated infra layer, while keeping backwards compatibility.

## Changes
- **MOVE (logical):** `contexts/projectStorage.ts` implementation moved to:
  - `infra/storage/projectPersistence.ts`
- **KEEP (compat):** `contexts/projectStorage.ts` now acts as a **facade re-export**:
  - `export * from "../infra/storage/projectPersistence";`

## Notes
- This patch is intentionally **behavior-preserving**: no runtime logic changes, only file relocation + import path fixes.
- Existing call sites that import from `contexts/projectStorage.ts` will keep working.

## Verification
Run:
- npm run typecheck
- npm run lint:ci
- npm run test:silent
