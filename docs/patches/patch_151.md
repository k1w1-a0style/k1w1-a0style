# Patch 151 – PR-4 Stage 2 (GitHub infra split)

Date: 2026-02-16

## Goal
Split the GitHub service monolith into focused modules while keeping the public API stable.

## Changes
- **Split** `infra/github/githubService.ts` into:
  - `infra/github/tokenStore.ts` (SecureStore tokens)
  - `infra/github/secrets.ts` (repo secrets sync + list)
  - `infra/github/repos.ts` (repo + branch operations)
  - `infra/github/files.ts` (contents API: create/update/delete/push/read)
  - `infra/github/workflows.ts` (workflow dispatch + run listing)
  - `infra/github/crypto.ts` (Buffer checks + base64 + secret encryption)
  - `infra/github/rateLimit.ts` (GitHub rate limiter)
  - `infra/github/utils.ts` (path + repo helpers)
- `infra/github/githubService.ts` is now a **barrel re-export** so existing imports continue to work.
- `contexts/githubService.ts` remains a **facade** (unchanged behavior).
- Updated `scripts/refactor/pr4-github-infra.sh` to detect Stage 1 vs Stage 2.

## Verification
Run:

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
