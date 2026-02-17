# Patch 177 — Sidebar polish + CI Lite header fix

Date: 2026-02-17

## Summary

- Sidebar (Drawer) visual polish: green borders are now thinner and use the app's primary accent color (matching the Chat screen), removing hard-coded neon-green RGBA.
- CI Lite header button: prefer the actively selected GitHub repo/branch (from GitHub Repos screen) to avoid stale `linkedRepo` causing GitHub 404.
- Better CI Lite error hints when the Edge proxy returns `GitHub API Status: 404`.

## Changes

### UI
- `components/CustomDrawer.tsx`
  - Replace hard-coded `rgba(0,255,0,...)` with `theme.palette.primary` + alpha.
  - Reduce prominent border widths (active items, badges, chips) to a finer look.
  - Keep existing layout/icons; only color + border weight adjusted.

### CI Lite / Logs
- `components/CiLiteHeaderButton.tsx`
  - `githubRepo` and `branch` now prefer `activeRepo/activeBranch` over `projectData.linkedRepo/linkedBranch`.
  - Adds a clearer hint for upstream GitHub 404 cases.
- `hooks/useGitHubActionsLogs.ts`
  - Improve `GitHub API Status: 404` hint to point to repo/permissions.

## Verification

1. Open the app → open Drawer:
   - Active item highlight should be subtle, with thin borders.
   - Accent green should match the chat screen (no bright neon-green frames).
2. Trigger CI Lite from header:
   - Ensure a repo is selected in **GitHub Repos**.
   - CI Lite should use that repo even if an old `linkedRepo` exists.
   - If it still fails with GitHub 404, error message should mention repo/workflow or token permissions.

## Notes

This patch intentionally does **not** add `SIGNING_MASTER_KEY` to the Credentials Wizard UI (per latest decision).
