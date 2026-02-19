# Patch 213: fix missing GitHub API URL helper import

## What changed
- Fix TypeScript error in `useConnectionsScreen` by importing `githubApiUrl` from the centralized GitHub constants.

## Why
Patch 211 introduced centralized GitHub API base URL helpers, but one screen used the helper without importing it.

## Verification
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
