# Patch 295: RepoScreen per-file Diff Preview

## Ziel
- Pro Datei einen schnellen, übersichtlichen Diff/Preview direkt aus der Diff-Liste heraus.
- TS/Tests wieder grün (Fix für Patch 294 Regressions: fehlende Variablen).

## Änderungen
### RepoScreen
- `screens/GitHubReposScreen/index.tsx`
  - `showRepoList` wird wieder korrekt aus dem VM (Hook) bezogen, damit Tests/UX-Toggles funktionieren.

### Diff UI
- `screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx`
  - Fix: entfernt nicht-deklarierte Variablen (`preview`, `statusEmoji`).
  - Per-File Preview:
    - Tap auf eine Datei öffnet ein Modal.
    - Für `modified`: Unified Line Diff ("+"/"-") + Local/Remote Text.
    - Für `localOnly` / `remoteOnly`: kurze Erklärung + passende Preview.
  - Auswahl (Checkbox) bleibt für pushbare Files (`modified` + `localOnly`).

## Hinweise
- Diff-Algorithmus ist LCS-basiert und hat Schutz gegen sehr große Dateien (Fallback auf reine Local/Remote Ansicht).
- Preview ist bewusst als "UI-Preview" ausgelegt (kein Git-Commit-Diff), damit keine zusätzlichen Dependencies nötig sind.
