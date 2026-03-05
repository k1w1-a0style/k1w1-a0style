# Patch 380 — CI Lite dispatch robustness (ref as input + auto-bootstrap on 422)

## Why
Some repos can have an older CI Lite workflow definition that **does not declare** newer `workflow_dispatch` inputs (e.g. `job_id`).
When the app dispatches the workflow with those inputs, GitHub returns **422 Unprocessable Entity** (`Unexpected inputs provided`).

Also, CI Lite should always evaluate the **selected branch** (source-of-truth in the app) even when the workflow is dispatched from a stable ref.

## What changed
- **App dispatch payload:** CI Lite and CI Lite Autofix now send `inputs.ref = branch` along with `inputs.job_id`.
  - This keeps the selected branch as the source-of-truth for checkout/analysis inside the workflow.
- **Edge dispatch resilience:** On GitHub dispatch **422 Unexpected inputs**, the edge function now:
  1) bootstraps/overwrites the managed workflow file from the canonical template, then  
  2) retries the dispatch once.

## Notes
- This is safe and idempotent: only managed workflow filenames are affected.
- Works for repos that were previously bootstrapped with older templates.
