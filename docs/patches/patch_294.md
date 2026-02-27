# Patch 294: RepoScreen Diff (+/-) + Push nur geänderte Dateien

## Ziele
- Diff im RepoScreen klar wie in Git-Tools: **+ / - / ±** statt Emoji-Liste.
- **Dateiauswahl direkt im Diff**: geänderte Dateien auswählen und *nur diese* pushen.
- Test/UX Regression fix: `showRepoList=false` darf keine Repo-Items rendern.

## Änderungen
### RepoScreen
- `screens/GitHubReposScreen/index.tsx`
  - Repo-Liste respektiert wieder `showRepoList` (wenn false → keine Items).
  - Diff-Section kann jetzt `onPushSelected(paths)` auslösen.

### Diff UI
- `screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx`
  - Neue Diff-Darstellung:
    - `+` **localOnly** (grün)
    - `-` **remoteOnly** (rot)
    - `±` **modified** (gelb)
  - Default-Ansicht zeigt **nur Änderungen** (kein „Heckmeck“).
  - Toggle: „Alle“ ↔ „Nur Änderungen“.
  - Checkboxes nur für pushbare States (**modified + localOnly**).
  - Chip: **Push Auswahl (N)** → öffnet Push-Modal mit vorselektierten Dateien.

### Push Integration
- `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
  - Neues `openPushModalForPaths(paths)`:
    - filtert automatisch auf **lokal vorhandene** Dateien
    - blockt „remote-only“ Auswahl sauber ab

## Hinweise
- Remote-only Dateien können nicht gepusht werden (kein lokaler Content) → werden im Diff angezeigt, aber nicht auswählbar für Push.
