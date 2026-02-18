# Patch 183: Flow unification + Build UX (actions/history) + Turbo checklist chips

## Summary
Consolidates the work-branch improvements into a single, coherent flow:
- **Build profile** (dev/preview/production) is persisted globally and reused across **Wizard + Diagnostic**.
- **Repo/branch** is chosen once in the Repo screen and reused in Build screen (Build screen shows it read-only).
- Build start / One‑Click Deploy are guarded by a checklist with **quick-action chips**, now with badges + fix-order sorting.

## Major changes
- **Enhanced Build**
  - GitHub Actions section restored (filterable).
  - Workflow run detail modal (run + jobs; copy/open links).
  - Build History filter-aware export:
    - Copy JSON = current filter
    - Share CSV = current filter
- **Repo screen**
  - Branch selector: search + per-repo recent branches.
- **Preview**
  - WebView navigation hardening (no `originWhitelist="*"`).
- **Hygiene**
  - `.gitignore` cleaned; ignores `.gitconfig` and `.emergent/`.
  - Removed unfinished placeholders (e.g. dead diff stubs) and typing hacks.

## Files changed
- `.gitignore`
- `.github/workflows/k1w1-triggered-build.yml`
- `infra/github/workflows.ts`
- `lib/storageKeys.ts`
- `screens/PreviewScreen.tsx`
- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`
- `screens/DiagnosticScreen/*`
- `screens/EnhancedBuildScreen/*`
- `screens/GitHubReposScreen/*`
- `styles/enhancedBuildScreenStyles.ts`

## Verification
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- In-app:
  - Choose repo/branch once → Build screen shows it read-only
  - Switch build profile → Wizard + Diagnostic follow automatically
  - Actions list opens run detail modal; History export matches current filter

## One-time manual cleanup (if applicable)
Unzip cannot delete files. If these exist and/or were ever committed:
- `rm -f .gitconfig` and if tracked: `git rm --cached .gitconfig`
- `rm -rf .emergent` and if tracked: `git rm -r --cached .emergent`
