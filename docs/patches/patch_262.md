# Patch 262

Fixes TypeScript typecheck errors introduced by Edge validation helpers being imported into the app/test TypeScript program.

## Changes
- Add a `// @ts-expect-error` on the Deno-required `./security.ts` import to avoid TS5097 when `allowImportingTsExtensions` is not enabled for the app.
- Make JSON parse error handling type-safe in `parseJsonBody`.
- Fix union narrowing for `validateBranch` results so `br.value` is only accessed when `br.valid` is true.

## Why
- Supabase Edge (Deno) requires explicit `.ts` extensions, but the app `tsc` run does not enable `allowImportingTsExtensions`.
- Contract tests import these helpers, so the file must typecheck in both environments.
