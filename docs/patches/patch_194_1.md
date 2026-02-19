# Patch 194.1 — hotfix build screen hook parse error

## What
Fix a TypeScript parse error introduced in Patch 194 (`useEnhancedBuildScreen.ts` had a stray `import` token line).

## Why
`tsc`/ESLint/Jest fail with `TS1109: Expression expected` / `Unexpected keyword 'import'`.

## Files
- `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts`
