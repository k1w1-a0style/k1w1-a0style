# Patch 96 Notes

Stand: **2026-02-13**

## Problem
In `__tests__/githubReposScreen.list.test.tsx` referenziert das `jest.mock()`-Factory eine Variable aus dem äußeren Scope. Jest blockt das standardmäßig, weil es ein häufiger Grund für uninitialisierte Mock-Variablen ist.

## Fix
- Mock-Funktion umbenannt auf **`mockUseGitHubReposScreen`** (Prefix `mock`). Dadurch ist die Referenz in der `jest.mock()`-Factory erlaubt.

## Optik
Keine Änderungen.
