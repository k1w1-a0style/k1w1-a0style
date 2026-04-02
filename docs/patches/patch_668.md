# Patch 668 — Refactor-Durchlauf 28 (GitHubRepos component typing follow-up)

## Ziel
Den naechsten GitHubReposScreen-UI-/Modal-/Selection-Block helper-first nachziehen, ohne Pull/Push-/Sync-/EAS-Orchestrierung umzubauen.

## Umgesetzt
- `screens/GitHubReposScreen/index.tsx`
  - `catch (e: any)` im Manage-Modal auf `unknown` + `getErrorMessage(...)` umgestellt.
- `screens/GitHubReposScreen/components/DiffFilesSection.tsx`
  - Diff-Fehlerpfad auf `unknown` + `getErrorMessage(...)` umgestellt.
- `screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx`
  - Fehlerpfade fuer Remote-File-Reads helper-first auf `unknown` gezogen.
- `screens/GitHubReposScreen/components/SecretsSection.tsx`
  - Repo-Secret-List-Fehlerpfad nutzt jetzt `unknown` + `getErrorMessage(...)`.
- `screens/GitHubReposScreen/components/PullPreviewModal.tsx`
  - `preview.remote` auf echten `ProjectFile[]`-Vertrag gezogen statt `any[]`.

## Kritischer Nachzug
- Der doppelte TODO-Plan-Eintrag fuer Durchlauf 28 wurde konsolidiert.
- Die irrefuehrende Patch-667-Aussage eines repo-weiten `0`-Scans in `docs/04-risk-hotspots.md` wurde auf den tatsaechlichen lokalen Zielblock korrigiert.

## Wirkung
- Der GitHubReposScreen-Cluster hat in den angefassten UI-/Modal-/Selection-Dateien keine lokalen `: any` / `as any`-Reste mehr.
- Keine Pull-/Push-/Sync-/EAS-Vertragsaenderung.
- Fehlertexte bleiben fachlich gleich, laufen aber zentral ueber bestehende Error-Helper.

## Checks
- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`
