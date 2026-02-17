# Patch 162: PR-7 stage 3.1 fix facade audit + remaining imports

## Why
Patch 161 introduced an audit script to detect facade imports. The initial audit was too broad (it matched docs/notes),
and it also revealed a couple of remaining runtime/test imports that still referenced facades.

## Changes
- Fix remaining facade imports:
  - `components/CiLiteHeaderButton.tsx`: `contexts/githubService` → `infra/github/githubService`
  - `__tests__/chatHistoryMigration.test.ts`: `contexts/projectStorage` → `infra/storage/projectPersistence`
- Make the audit script precise:
  - `scripts/refactor/pr7-facade-audit.sh` now detects only real `import ... from` / `require(...)` usage
  - Excludes `docs/` and `backups/` to avoid false positives

## Verification
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `bash scripts/refactor/pr7-facade-audit.sh`
