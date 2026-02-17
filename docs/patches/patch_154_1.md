# Patch 154.1 — Hotfix

**Date:** 2026-02-17

## Why
Patch 154 accidentally imported `useBuildStatus` twice in `contexts/ProjectContext.tsx`. This caused:
- TypeScript error `TS2300: Duplicate identifier 'useBuildStatus'`
- Jest parse errors (the file could not be parsed)

## Changes
- Remove the duplicate import of `useBuildStatus` in `contexts/ProjectContext.tsx`.

## Verification
Run:
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
