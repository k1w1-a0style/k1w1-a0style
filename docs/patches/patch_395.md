# Patch 395

## Summary
- add `repository_dispatch` support to `k1w1-ci-lite.yml` with `trigger-ci-lite`
- switch CI Lite Autofix chain-run from `workflow_dispatch` to `repository_dispatch`
- surface workflow provenance (`workflow_ref`, `workflow_sha`, trigger/source metadata) in `ci-lite-result.json`
- sync the same behavior into `infra/github/workflowTemplates.ts` and `supabase/functions/github-workflow-dispatch/index.ts`

## Rationale
GitHub evaluates dispatched workflows from the default-branch workflow definition. This patch makes the CI Lite chain-run less brittle by using a stable `repository_dispatch` contract and by writing enough provenance into artifacts/summaries to make default-branch staleness visible during debugging.

## Files
- `.github/workflows/k1w1-ci-lite.yml`
- `.github/workflows/k1w1-ci-lite-autofix.yml`
- `infra/github/workflowTemplates.ts`
- `supabase/functions/github-workflow-dispatch/index.ts`
- `CI-lite chain-dispatch invariant coverage`
