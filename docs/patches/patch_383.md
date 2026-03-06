# Patch 383 — Workflow hardening for explicit ref handling and manual-path transparency

## Why

The app’s Single Source of Truth is the selected target repo + branch.
GitHub workflows should follow that truth explicitly instead of relying on hidden defaults.

## What changed

- `eas-build.yml`
  - checkout now uses `inputs.ref || github.ref_name`
  - `fetch-depth: 0` added for safer branch/ref operations
  - autofix writeback regex now allows `main` and `release/*` in addition to the previous set
- `eas-link.yml`
  - no silent `main` default anymore
  - explicit `ref` is required during validation
- `release-build.yml`
  - summary is written to `$GITHUB_STEP_SUMMARY`
  - summary explicitly marks the workflow as a manual bypass path outside the normal app-controlled flow

## Notes

This does **not** remove the manual workflow path.
It makes the path more honest and reduces the chance of having two hidden truths in parallel.
