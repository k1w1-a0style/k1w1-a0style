# Patch 374 — CI-Lite workflow SoT + deterministic result artifact

## Problem

CI-Lite needs a deterministic, machine-readable result so the in-app Header can show a stable green/red state
without scraping logs. Also, the workflow must reliably checkout the *requested* branch/ref (inputs.ref), even
if the workflow file itself lives on another ref.

## Fix

- Replace `.github/workflows/k1w1-ci-lite.yml` with a robust `workflow_dispatch` workflow that:
  - checks out `inputs.ref || github.ref_name`
  - runs lint + typecheck with fallback to `npx`
  - uploads `ci-logs/ci-lite-result.json` + logs as artifact `ci-lite-logs`
- Replace `.github/workflows/k1w1-ci-lite-autofix.yml` with a robust autofix workflow that:
  - does guarded writeback
  - produces `ci-logs/ci-lite-autofix-result.json` + logs as artifact `ci-lite-autofix-logs`
- Update both workflow template sources of truth:
  - `infra/github/workflowTemplates.ts`
  - `supabase/functions/github-workflow-dispatch/index.ts`

## Why this matters

Your in-app polling can now deterministically map:

`job_id → run → artifact(ci-lite-logs) → ci-lite-result.json → header status`

No log parsing, no false-green.

