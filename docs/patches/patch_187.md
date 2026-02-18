# Patch 187

## Summary
Hotfix for Patch 185/186 TypeScript drift in the new Repo screen sections.

## Fixes
- Repo screen: replace `theme.palette.danger` with the existing `theme.palette.error`.
- Repo screen hook: expose `userLogin`, `userLoading`, and `activeRepoObj` so the new UI can render without unsafe casts.

## Files changed
- `screens/GitHubReposScreen/components/DiffFilesSection.tsx`
- `screens/GitHubReposScreen/components/HeaderSection.tsx`
- `screens/GitHubReposScreen/components/SecretsSection.tsx`
- `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_187.md`
