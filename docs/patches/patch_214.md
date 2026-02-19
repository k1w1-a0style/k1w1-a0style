# Patch 214

## Summary

Fix GitHub repo/branch **source-of-truth drift**:

- Prefer `GitHubContext` active repo/branch over `ProjectContext` linked repo/branch in CI Lite.
- When importing backups, persist the active repo/branch back into `ProjectContext` so the app stays consistent after hydration.

## Notes

- No behavioral change for users who never import backups.
- Prevents "snap back" to stale linked repo/branch after import / app restart.
