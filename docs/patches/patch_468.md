# Patch 468

## Titel
GitHubReposScreen-Architekturblock konservativ beruhigt (Sync-Vergleich + Push-Konsolidierung)

## Kontext
Der letzte bestätigte Architekturrest im GitHubReposScreen war weiterhin zu request-intensiv:
- Sync-Status verglich lokal vs. remote über viele per-file Contents-Requests.
- Push lief im Multi-File-Fall über dateiweise Contents-API-Commits.

## Änderungen
- `infra/github/files.ts`
  - Neuer zentraler Vergleichspfad `compareLocalFilesWithRepo(...)` auf Basis von Tree-Blob-SHAs statt per-file Content-Downloads.
  - `listRepoBlobEntries(...)` ergänzt (Pfad + SHA aus Trees API), `listRepoBlobPaths(...)` darauf reduziert.
  - `pushFilesToRepoAdvanced(...)` auf Git Data API umgestellt: `git/trees` → `git/commits` → `git/refs/heads/...` (ein konsolidierter Commit für den Push-Selektionssatz).
  - Branch-Auflösung zentralisiert (`resolveTargetBranch(...)`) mit bestehendem defensivem Fallback.
- `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
  - `refreshSyncStatus(...)` nutzt jetzt den zentralen Infra-Vergleich statt per-file `getRepoFileText(...)`-Loop.
  - Bestehender stale-run-Guard (`syncStatusRunRef`) bleibt unverändert aktiv.
  - Push-Erfolgs-Hinweistext auf konsolidierten Commit angepasst.
- `__tests__/patch468.githubReposScreen.architecture.invariants.test.ts`
  - Invariants für zentralen Sync-Vergleich und konsolidierten Push-Pfad ergänzt.

## Verifikation
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Hinweis / bewusst offen
- Pull-Downloadpfad (`hooks/useGitHubRepos.ts`) bleibt bewusst ohne Broad-Refactor. Ziel dieses Patches war der bestätigte letzte Architekturblock (Sync-Vergleich + Push-Ruhe) im GitHubRepos-/RepoSync-Bereich.
