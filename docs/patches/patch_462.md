# Patch 462 — GitHubReposScreen Restpunkte (Typing/Sync/Branch)

## Ziel
Konservative, minimale Stabilisierung des GitHubReposScreen-Hooks ohne Architekturumbau: Root-`any` entfernen, Sync-Status gegen stale Runs härten, Default-Branch nach Repo-Creation übernehmen.

## Änderungen
- `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
  - `projectFiles` von Root-`any[]` auf `ProjectFile[]` umgestellt.
  - `pullPreview`/`syncStatus` lokal typisiert (`PullPreviewState`, `SyncStatus`, `EMPTY_SYNC_STATUS`).
  - `refreshSyncStatus` mit `syncStatusRunRef` gegen stale Async-Ergebnisse gehärtet.
  - `handleCreateRepo` übernimmt `repo.default_branch` direkt in Active-/Linked-Branch.
  - Pull-/Push-nahe `any`-Casts gezielt reduziert (`handlePull`, Push-Auswahl, `confirmPushSelected`, `applyPulledFiles`).
- `hooks/gitHubReposTypes.ts`
  - `GitHubRepo` um optionales Feld `default_branch?: string | null` ergänzt.
- `__tests__/patch462.githubReposScreen.restFixes.invariants.test.ts`
  - Invariants für Root-Typing, stale-run-Guard und Default-Branch-Übernahme.

## Offen / bewusst nicht Teil von Patch 462
- Kein Umstieg von Contents-API auf Git Data API (bewusst außerhalb dieses minimalen Restfix-Schritts).
- Keine breite Pull-Filter-/EAS-Flow-Architekturänderung; nur lokale Stabilisierung im bestehenden Flow.
