# Patch 657 — Refactor-Durchlauf 18 (infra/typing helper-first)

## Ziel

Den naechsten kleinen produktionsnahen `: any`-Hotspot im GitHub-Infra-Bereich abbauen, ohne den API-/Workflow-Vertrag zu veraendern.

## Umsetzung

- Neue Helper-Datei `infra/github/githubResponseHelpers.ts` eingefuehrt:
  - `readJsonRecordSafe(...)`
  - `readGitHubMessage(...)`
  - `readStringField(...)`
  - `readNestedSha(...)`
  - `hasGitHubErrorMessageContaining(...)`
- `infra/github/branchOps.ts` liest Branch-Ref-/Rename-/HEAD-Responses jetzt ueber die neuen Helper statt ueber lokale `: any`-JSON-Pfade.
- `infra/github/repos.ts` nutzt dieselben Helper fuer Repo-/User-/Error-Responses und den `name already exists`-Sonderfall.

## Nicht-Ziel

- Kein API-/Workflow-Vertragswechsel
- Kein Umbau der Repo-/Branch-Orchestrierung
- Kein Broad Cleanup weiterer Infra-Dateien

## Checks

- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`

## Ergebnis

Kleiner helper-first Typing-Schritt im produktionsnahen Infra-Bereich. Die frueheren lokalen `: any`-JSON-Pfade in `branchOps.ts` und `repos.ts` sind entfernt; der naechste naheliegende Scope bleibt `importExportHelpers.ts` plus verbleibende `jsonUtils`-Callervertraege.
