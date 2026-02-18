# PATCH 91 – GitHubReposScreen Refresh/Parsing Hardening

Datum: 2026-02-12

## Ziel
- RS-004: Refresh darf nach Unmount keinen State mehr setzen (kein setState-after-unmount).
- RS-005: `owner/repo` Parsing muss strikt und robust sein (exakt ein `/`, sinnvolle Pattern/Length).
- Regression-Schutz via Unit-Tests.

## Änderungen
### GitHubReposScreen
- `handleRefresh`: Generation-Guard + mounted-guard (`refreshGen`, `isMountedRef`).
- `splitFullName`: strengere Validierung (Owner-Regeln + Repo-Regeln über `isValidRepoName`).

### Tests
- Neuer Jest-Test: `__tests__/githubReposParsing.test.ts`

## Optik
Keine Layout-Änderungen. Nur stabileres Verhalten bei Refresh + strengere Eingabe/Parsing-Regeln.

## Dateien
- `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
- `screens/GitHubReposScreen/utils/repos.ts`
- `__tests__/githubReposParsing.test.ts`
- `PROJECT_CHECKLOG.md`
- `docs/TODO.md`
- `docs/reviews/GITHUB_REPOS_SCREEN_VERIFICATION.md`
- `docs/reviews/TERMINAL_SCREEN_VERIFICATION.md`

