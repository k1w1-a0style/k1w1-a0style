# PATCH 95 NOTES

Stand: **2026-02-13**

## Ziel
Hotfix für Patch 94 (GitHubReposScreen Virtualisierung + List-Flow-Tests).

## Fixes
- **ESLint react-hooks/rules-of-hooks:** `useMemo`/`useCallback` wurden nach einem frühen `return` aufgerufen → jetzt vor dem Token-Guard definiert.
- **Jest Mock Scope:** `jest.mock()`-Factory referenzierte `TouchableOpacity`/`Text` aus dem Outer-Scope → jetzt `require("react-native")` innerhalb der Factory.

## Optik
Keine UI-/Layout-Änderungen.

## Dateien
- `screens/GitHubReposScreen/index.tsx`
- `__tests__/githubReposScreen.list.test.tsx`
- `docs/TODO.md`
- `PROJECT_CHECKLOG.md`
- `docs/reviews/GITHUB_REPOS_SCREEN_VERIFICATION.md`
- `docs/reviews/TERMINAL_SCREEN_VERIFICATION.md`
