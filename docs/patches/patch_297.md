# Patch 297: RepoScreen inline diff hotfix

## Summary
Fixes a TSX parse/syntax regression introduced in Patch 296.

## What changed
- **Fix:** `LocalRemoteDiffSection` list rendering now wraps each diff item row in a container (`<View />`) so the inline expand block is valid JSX/TSX (single root return per map item).
- Keeps all Patch 296 UX features (inline expand, colored +/- diff lines, compact view, inline copy + modal details).

## Files
- `screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_297.md`
