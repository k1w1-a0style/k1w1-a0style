# Patch 305: CI/EAS workflow-dispatch 404 hardening

## Why
Some repos/branches don’t yet contain the managed workflows under `.github/workflows/…`. Dispatching a workflow by name then returns a 404 even though the app UI expects CI Lite / Diagnostics to “just work” for the currently selected repo/branch.

## What
- **Workflow dispatch now resolves by workflow *id*** (via `GET /actions/workflows`) when a workflow file name/alias is provided.
- **Auto-bootstrap known workflows** when dispatch returns **404**:
  - Writes missing workflow files into the selected branch under `.github/workflows/…` using GitHub Contents API.
  - Retries a few times (short backoff) until GitHub registers the workflow, then dispatches.
- Supports short aliases (e.g. `ci`, `ci-lite`, `diagnostics`) mapped to managed filenames.
- Keeps upstream status codes (401/403/422/404) so the client can show accurate guidance.

## Files changed
- `supabase/functions/github-workflow-dispatch/index.ts`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_305.md`
