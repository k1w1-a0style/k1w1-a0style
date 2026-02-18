# Patch 79 Notes — GitHubReposScreen correctness/race hardening

Date: 2026-02-12

## Summary
This patch fixes three P1 issues from the RepoScreen critical review:
- RS-001: Recent repo pills now go through the same selection logic as list selection (single source of truth).
- RS-002: BranchSelector now ignores stale async responses when switching repos quickly (race-safe).
- RS-003: Manage modal confirm/cancel are disabled while async action runs, with a small spinner (prevents double-submit).

## UX / Optics
- No layout or styling changes in normal state.
- Manage modal shows a small loading spinner and disabled buttons/inputs only while an action is in-flight.

## Files changed
- screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts
- screens/GitHubReposScreen/components/FilterSection.tsx
- screens/GitHubReposScreen/components/BranchSelector.tsx
- screens/GitHubReposScreen/index.tsx
- PROJECT_CHECKLOG.md
- docs/TODO.md
- docs/patches/PATCH_79_NOTES.md
