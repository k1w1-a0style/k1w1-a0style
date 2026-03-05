# Patch 377 — CI-Lite backchannel: compatible with codex-13 + Edge deploy fix

## What this fixes

- **Header TypeScript error**: ensures the admin key is awaited before being used as a header value.
- **Supabase deploy error (zip import)**: uses a Deno-std URL import for ZIP reading instead of a non-exported/relative module path.
- **Project compatibility**: current project state had only `githubFetch(url, init)`; the new artifact function needs explicit-token helpers.

## Files changed

- `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`
- `supabase/functions/_shared/github.ts`
- `supabase/functions/github-run-artifact-json/index.ts`

## Notes

After applying, run `supabase functions deploy` so the new function is live.
