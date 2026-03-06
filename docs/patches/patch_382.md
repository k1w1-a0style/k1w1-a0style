# Patch 382 — Build screen CI Lite gating and stale transparency

## Why

The build service now enforces CI Lite freshness and Repo/Branch matching.
The Build screen should show the **same truth** before the user presses Build, otherwise UI and service drift apart.

## What changed

- `useBuildPreconditions` now evaluates CI Lite against:
  - green lint/typecheck result
  - matching repo
  - matching branch
  - non-stale timestamp
- Added UI-facing state:
  - `ciLiteReason`
  - `ciLiteStale`
- `useEnhancedBuildScreen` now:
  - removes the repo fallback to config
  - blocks build with the concrete CI Lite reason
  - surfaces stale CI Lite runs more clearly in the checklist

## Notes

This keeps Build Screen behavior aligned with the service-level gate.
Without this patch, the backend gate could reject builds that still looked "mostly okay" in the UI.
