# Patch 293: RepoScreen UI cleanup + Secrets Sync

## Ziele
- RepoScreen soll **komplett** und **übersichtlich** sein (keine "X"/Panels zum Schließen).
- Repos laden automatisch (Button "Repos laden" entfernt).
- Repo/Branch Actions direkt dort, wo sie hingehören (Icons an den "Platten").
- Secrets Sync Button sichtbar verfügbar.
- Nur **eine** Diff-Ansicht (Lokal ↔ Online) im Screen.

## Änderungen

### UI / UX
- **Header**: Titel bleibt stabil (kein unschönes Umbruch/"Buchstaben senkrecht"), weniger Action-Icons.
- **Repo Liste**: immer sichtbar (kein Toggle/Close-"X").
- **Repo Actions**: pro Repo-Platte rechts **Pencil (Rename)** + **Trash (Delete)**.
- **Branch Actions**: direkt im Branch Dropdown-Header: **+ (Create)**, **Pencil (Rename)**, **Trash (Delete)**.
- **Token Section**: Button "Repos laden" entfernt (Repos auto-load via Hook).
- **Diff**: `DiffFilesSection` aus RepoScreen entfernt → `Diff Lokal ↔ Online` ist die Single Source.

### Secrets
- Secrets Section bekommt zusätzlich den Button **"Secrets synchronisieren"** (wird im Hook über autoSyncRepoSecrets bedient).

## Betroffene Dateien
- `screens/GitHubReposScreen/index.tsx`
- `screens/GitHubReposScreen/components/HeaderSection.tsx`
- `screens/GitHubReposScreen/components/TokenStatusSection.tsx`
- `screens/GitHubReposScreen/components/BranchSelector.tsx`
- `screens/GitHubReposScreen/components/BranchSelector.styles.ts`
- `screens/GitHubReposScreen/components/SecretsSection.tsx`
- `components/RepoListItem.tsx`
- `docs/patches/PATCHLOG_ROOT.md`

## Notes
- Keine bestehende Logik entfernt (Repo/Branch persistence bleibt über ProjectContext/SoT).
- Branch/Repo Rename/Delete weiterhin über bestehende Hook-Handler.
