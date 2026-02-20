# Patch 227 — CI Lite Closure-Hardening + Docs

**Ziel:** Den letzten „stale closure“ Edge-Case im CI Lite Patch-Apply Flow wirklich dicht machen und die Doku sauber nachziehen.

## Änderungen

### 1) CI Lite: `applyPatchFromText` deps komplett

Datei: `components/CiLiteHeaderButton.tsx`

- `applyPatchFromText` nutzt neben `githubRepo`/`branch` auch Service-Funktionen, die (je nach Hook-Implementierung) referenziell wechseln können.
- Der `useCallback`-Deps-Array enthält jetzt zusätzlich:
  - `getDefaultBranch`
  - `pushFilesToRepo`
  - `deleteRepoFile`
  - `getGitHubToken`

**Effekt:** Wenn Repo/Branch gewechselt wird (oder Services neu gebunden werden), wird garantiert in das aktuell ausgewählte Ziel gepusht/gelöscht.

### 2) Docs alignment

- `docs/TODO.md` aktualisiert (Patch 226/227 Status)
- `docs/patches/PATCHLOG_ROOT.md` erweitert (226.2 + 227)
- `PROJECT_CHECKLOG.md` aktualisiert

## Checks

```bash
npm run test:silent
```

(Pre-commit/Husky macht typecheck/lint ohnehin.)
