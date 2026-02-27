# Patch 291

## Summary
- Rebuild **RepoScreen** UI to be cleaner and “single source of truth” friendly (repo/branch selection stays persistent via existing contexts).
- Restore **Push / Pull** actions and add a dedicated **Sync** section with safe loading/disable states.
- Add repo/branch management UI: **create repo**, **rename repo**, **create/rename/delete branch** (modals + confirmations).
- Add **Diff Lokal ↔ Online** with remote-only detection (tree listing) + a **Dirty** indicator in the header.
- Upgrade Push/Pull flows:
  - **Push**: commit message + file selection
  - **Pull**: preview + conflict strategy (overwrite vs skip conflicts)

## Notes
- Remote-only detection uses the Git Trees API for listing paths, with conservative limits to avoid API explosions.
- Push remains based on the GitHub Contents API semantics (per-file updates), but now supports commit message + selecting which files to push.

## Files
- `screens/GitHubReposScreen/index.tsx` (updated)
- `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts` (updated)
- `screens/GitHubReposScreen/components/HeaderSection.tsx` (updated)
- `screens/GitHubReposScreen/components/RepoSyncSection.tsx` (new/updated)
- `screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx` (new)
- `screens/GitHubReposScreen/components/BranchManageSection.tsx` (new)
- `screens/GitHubReposScreen/components/ManageTextModal.tsx` (new)
- `screens/GitHubReposScreen/components/PushOptionsModal.tsx` (new)
- `screens/GitHubReposScreen/components/PullPreviewModal.tsx` (new)
- `hooks/useGitHubRepos.ts` (updated)
- `infra/github/files.ts` (updated)
- `docs/patches/PATCHLOG_ROOT.md` (updated)
- `docs/patches/patch_291.md` (new)
