# Patch 300: RepoScreen polish (no filter) + Pull supports dotfiles

## Changes

- **RepoScreen:** Removed the **Filter** UI entirely (search field + chips + close/extra panel behavior). The Repo list is now always a clean list.
- **Pull:** Treat common text dotfiles as text (so they can be pulled into the project):
  - `.gitignore`, `.easignore`, `.npmrc`, `.prettierrc`, `.prettierignore`, `.editorconfig`

## Why

- The filter UI added clutter and didn’t provide enough value for the RepoScreen.
- `.gitignore` / `.easignore` were flagged as remote-only and **never pulled** because the pull logic only allowed a text extension list; dotfiles failed that allowlist.

## Files

- `screens/GitHubReposScreen/index.tsx`
- `hooks/useGitHubRepos.ts`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_300.md`
