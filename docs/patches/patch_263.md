# Patch 263: Fix typecheck for Supabase Edge validation helpers

**Datum:** 2026-02-24

## Problem
`npm run typecheck` (tsc) schlägt fehl, weil Supabase Edge Functions (Deno) Imports mit `.ts` Extension brauchen, während dein App-Typecheck (`tsc`) standardmäßig `allowImportingTsExtensions` nicht aktiviert hat (TS5097).  
Zusätzlich gab es ein paar Stellen in `validation.ts`, wo `unknown` / Union-Typen nicht sauber genarrowed wurden.

## Fix
- `supabase/functions/_shared/validation.ts`
  - TS5097 wird lokal am Import sauber unterdrückt (`// @ts-ignore` direkt über dem Import)
  - `catch (e)` korrekt als `unknown` behandelt (`e instanceof Error ? e.message : String(e)`)
  - Union-Narrowing für `validateBranch()` Resultat, damit `br.value` nicht mehr auf dem falschen Union-Ast gelesen wird

## Ergebnis
- `npm run test:silent` bleibt grün
- `npm run typecheck` läuft wieder durch
