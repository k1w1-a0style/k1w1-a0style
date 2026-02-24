# Patch 263b: Fix TS5097 in app typecheck

**Datum:** 2026-02-24

## Problem
`npm run typecheck` (`tsc --noEmit`) schlägt fehl, weil im Supabase Edge (Deno) Code Imports mit `.ts` Extension verwendet werden (z.B. `./security.ts`).
TypeScript meldet TS5097, wenn `allowImportingTsExtensions` nicht aktiviert ist.

## Fix
- `tsconfig.json`: `compilerOptions.allowImportingTsExtensions = true`

## Ergebnis
- `npm run typecheck` läuft wieder durch, ohne Supabase Edge Imports umzubauen.
