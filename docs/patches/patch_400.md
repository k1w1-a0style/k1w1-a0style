# Patch 400 — CI Lite SHA fallback polish + metadata cleanup

## Summary
This patch closes three small cleanup items left after patch 399:

1. `useCiLiteWorkflow.ts` now reads `source_sha` and `github_sha` from CI Lite artifact JSON in addition to the legacy `source_commit_sha` field.
2. `github-workflow-dispatch` now reports bootstrap metadata with workflow version `399` instead of stale value `4`.
3. `deploy-supabase-functions.yml` now really writes `ci-logs/deploy-metadata.env` before summary/upload, so the artifact reference is no longer hollow.

## Why
The repo was already green, but these three points were still slightly uneven:
- artifact typing and parsing were out of sync,
- edge bootstrap response metadata still reflected the EAS workflow family version,
- deploy summary referenced an artifact file that was never created.

## Files changed
- `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`
- `supabase/functions/github-workflow-dispatch/index.ts`
- `.github/workflows/deploy-supabase-functions.yml`
- `README.md`
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`
