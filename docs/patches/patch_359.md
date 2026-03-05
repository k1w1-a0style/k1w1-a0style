# Patch 359 — CI Lite Autofix dispatch 422 hardening

## Problem
In-app „Autofix ESLint“ triggered `github-workflow-dispatch`, but GitHub returned **422 Unprocessable Entity**:
`Unexpected inputs provided: ["ref","job_id"]`.

Root cause: the client passed `ref` and `job_id` inside `workflow_dispatch.inputs`. If the workflow on GitHub doesn’t declare these inputs (older file, fork, or template drift), GitHub rejects the dispatch.

## Fix
- **Client (CI Lite hook):** no longer sends `ref`/`job_id` as workflow inputs. `job_id` is sent as a top-level field for app-side correlation only.
- **Edge (`github-workflow-dispatch`):**
  - Sanitizes inputs (drops reserved keys like `ref` and `job_id`).
  - If GitHub still returns **422**, automatically retries the dispatch **without inputs** once.

## Files changed
- `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`
- `supabase/functions/github-workflow-dispatch/index.ts`
- `docs/patches/PATCHLOG_ROOT.md`
- `PROJECT_CHECKLOG.md`
