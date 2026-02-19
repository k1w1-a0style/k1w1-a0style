# Patch 207: fix GitHubReposScreen list test after cleanup

## Why
Cleanup patch 206 removed several legacy GitHubReposScreen section components (e.g. `ActionsSection`, `WorkflowRunsSection`).
The test `__tests__/githubReposScreen.list.test.tsx` still had `jest.mock()` calls pointing at those deleted files, causing Jest to fail at module resolution **even though the screen no longer imports them**.

## What changed
- Updated `__tests__/githubReposScreen.list.test.tsx` to mark the mocks for the deleted modules as **virtual** (`{ virtual: true }`).
  - This keeps the test stable across cleanups and avoids hard coupling to file existence.

## Expected result
- `npm run test:silent` passes again after patch 206.
