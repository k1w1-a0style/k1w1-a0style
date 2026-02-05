# GitHubReposScreen inventory (refactor)

## Logical blocks in the monolith

1. **Token bootstrap + gated UI**
   - Loads token via `getGitHubToken()` and shows loading / no-token screens.
2. **Repo data bootstrap + state restoration**
   - Auto-load repos once token exists.
   - Restore `linkedRepo` and `linkedBranch` from project state.
   - Load stored `EAS_PROJECT_ID`.
3. **Repo selection overlay**
   - Modal overlay for repo list and search.
   - Select repo + update active repo/branch + recent repo list.
4. **New repo modal**
   - Create repo by name with validation.
5. **Active repo card + actions**
   - Quick actions: Push / Pull / Open GitHub.
   - Secondary actions: Sync Secrets / EAS Link / Manage menu.
   - EAS workflow status chip + pull progress.
6. **Branch selector**
   - Load branch list + set active branch.
7. **Workflow runs section**
   - Show recent workflow runs for the repo.
8. **Manage modal (repo/branch)**
   - Reusable modal for rename/create/delete branch + rename/delete repo.

## Existing section components to use

- **BranchSelector** → fits block #6.
- **WorkflowRunsSection** → fits block #7.

## Existing section components NOT used (UI mismatch)

- `HeaderSection`, `TokenStatusSection`, `FilterSection`, `RepoListSection`,
  `NewRepoSection`, `RenameRepoSection`, `ActionsSection`.
  These components use the older layout/styles and would change the current UI.

