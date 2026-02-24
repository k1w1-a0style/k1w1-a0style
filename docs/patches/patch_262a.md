# Patch 262a: fix tsc TS5097 suppression placement

## Summary
Fixes `tsc --noEmit` failing on Supabase Edge validation helpers due to TS5097 (importing `.ts` extensions).

## Changes
- Move the TS5097 suppression directive to the exact import line for `./security.ts`, so TypeScript applies it and doesn't warn about an unused directive.

## Notes
- Supabase Edge (Deno) requires explicit `.ts` extension in relative imports.
- The app repo typecheck keeps `allowImportingTsExtensions` disabled; we suppress TS5097 locally at the import site only.
