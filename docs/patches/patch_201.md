# Patch 201: Deprecate legacy type shims (prep for shim removal)

## Goal
Reduce long-term type drift by making it explicit that legacy type re-export files are temporary.

## Changes
- `contexts/types.ts`: add `@deprecated` note to encourage direct imports from `shared/types/*`.
- `lib/buildStatusMapper.ts`: mark the `BuildStatus` re-export as `@deprecated` (mapping function remains supported).

## Notes
- No behavior changes.
- This patch is a documentation + maintenance guardrail only.
