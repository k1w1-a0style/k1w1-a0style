# Patch 369: CI-Lite in-app status uses GitHub truth (fix green/rot mismatch)

## Problem
The app could show **green** even when the GitHub Actions run is **red**, because the `github-workflow-logs` edge function returns run metadata under `run`, while the app expected `workflowRun`.

## Fix
- Normalize the edge response in `useGitHubActionsLogs` to accept **either** `workflowRun` or `run`.
- This ensures `computeCiLiteOk()` gets real `status/conclusion` and the header reflects GitHub truth.

## Files changed
- `hooks/useGitHubActionsLogs.ts`
