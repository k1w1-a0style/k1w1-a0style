# Patch 206: remove leftover dead UI section components

## What / Why
Several section components remained in the repo after earlier refactors (DiagnosticScreen tabs, EnhancedBuildScreen sections, GitHubReposScreen sections). They are **not imported anywhere** and only add maintenance surface.

This patch removes them via a safe cleanup script.

## Files removed
- `screens/DiagnosticScreen/components/IssuesTabSection.tsx`
- `screens/DiagnosticScreen/components/NonIssuesTabSection.tsx`
- `screens/EnhancedBuildScreen/components/DiffSection.tsx`
- `screens/EnhancedBuildScreen/components/GitHubActionsSection.tsx`
- `screens/GitHubReposScreen/components/ActionsSection.tsx`
- `screens/GitHubReposScreen/components/RepoListSection.tsx`
- `screens/GitHubReposScreen/components/WorkflowRunsSection.tsx`

## How to apply
```bash
chmod +x scripts/patch_206_cleanup.sh || true
./scripts/patch_206_cleanup.sh

npm run typecheck
npm run lint:ci
npm run test:silent
```
