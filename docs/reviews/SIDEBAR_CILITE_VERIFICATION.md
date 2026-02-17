# Verification — Sidebar polish + CI Lite header (Patch 177)

Date: 2026-02-17

## Scope

- Sidebar/Drawer visuals: ensure accent green matches the app theme and borders are not overly thick.
- CI Lite header button: ensure it targets the actively selected repo/branch, and error hints are helpful.

## Manual checks

### Drawer
1. Open the drawer from the header hamburger.
2. Verify:
   - Active menu item has a subtle highlight (thin border, no neon frame).
   - Chips/Badges/Logo icon use the same accent green as chat screen.
   - Pressed state still readable.

### CI Lite header
1. Go to **GitHub Repos**, select a repo and branch.
2. Return to any screen and press the CI Lite button in the header.
3. Verify:
   - The modal shows the selected repo/branch.
   - No immediate 404 due to stale `linkedRepo`.
   - If the Edge proxy returns GitHub 404, the UI error includes a hint about repo/workflow or token permissions.

## Automated
- No new tests added; relies on existing suites.

