# Patch 301: RepoScreen showRepoList gating (SoT)

## Why
A regression in Patch 300 removed the `showRepoList` gating from `GitHubReposScreen`, causing repo items to render even when the list is intentionally hidden (unit test + optional UX flows).

## What changed
- `GitHubReposScreen` now respects `showRepoList` again:
  - When `showRepoList === false`, repo list data is empty, so no repo items render.
  - Default behavior remains unchanged (list visible).

## Files changed
- `screens/GitHubReposScreen/index.tsx`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_301.md`
