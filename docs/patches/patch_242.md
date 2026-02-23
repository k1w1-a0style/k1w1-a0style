# Patch 242

## Purpose
Fix TypeScript/Jest failure introduced in Patch 241 where `infra/github/repos.ts` started using `logger` without importing it.

## Changes
- `infra/github/repos.ts`: add missing `logger` import.

## Verification
- `npm run test:silent`
- `npm run typecheck`
