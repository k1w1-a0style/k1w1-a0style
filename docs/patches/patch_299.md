# Patch 299: RepoScreen diff list sticky toolbar + expand/collapse all

## What changed

- Reworked the **LocalRemoteDiffSection** diff list to use a `FlatList` with a **sticky header toolbar**.
- Toolbar actions:
  - Toggle **Inline** vs **Modal** diff preview.
  - **Expand** / **Collapse** all (inline mode).
  - Toggle **Nur Änderungen** vs **Alle**.
  - **Select all / none** for pushable files.
  - **Push selected**.
  - **Copy list** of diff entries.
  - Optional **Alle** (alert) when there are more than 24 items.
- Inline expansion now supports an “expand all” mode without auto-fetching everything:
  - If a file’s diff isn’t cached yet, the inline panel shows a **Diff laden** button.

## Why

After the inline UX additions, the action chips scrolled away quickly on long diff lists. A sticky toolbar keeps the key actions accessible without hunting.

## Files changed

- `screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_299.md`
