# Patch 398

## Summary

Patch 398 closes the two highest-priority follow-ups after patches 393–397:

1. `supabase/functions/github-run-artifact-json/index.ts` no longer imports non-existent shared helpers and now uses the actual shared auth/CORS/GitHub utilities available in the repo.
2. `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts` now accepts `source_commit_sha`, `source_sha`, and `github_sha` when persisting the last successful CI Lite SHA.

## Files changed

- `supabase/functions/github-run-artifact-json/index.ts`
- `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`
- `__tests__/patch398.edgeAndCiLiteCompat.invariants.test.ts`
- `README.md`
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`

## Why

The artifact endpoint still referenced helper names that do not exist in the current shared edge helper layer, which risked runtime failures as soon as the function was invoked. In parallel, the CI Lite consumer still only trusted `source_commit_sha`, even though the hardened workflows now emit `source_sha` and `github_sha` as the canonical provenance fields.

## Result

- Edge artifact JSON lookup uses real shared helpers (`handleCors`, `requireAdminKey`, `getGithubToken`, `githubFetchJson`, `githubFetchRaw`).
- CI Lite header/build-gate persistence can consume both legacy and current SHA field names.
- The compatibility contract is guarded by a dedicated invariant test.
