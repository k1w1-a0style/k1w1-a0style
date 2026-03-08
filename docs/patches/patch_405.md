# Patch 405

Datum: 2026-03-08

## Inhalt
- Managed Workflow-Familie von Patch 404 auf workflow-version 405 gehoben.
- `eas-build.yml`, `eas-link.yml`, `release-build.yml` und `deploy-supabase-functions.yml` Summaries um sichtbare `workflow version`-Zeilen ergänzt.
- `scripts/check_managed_workflows.sh` verschärft: vergleicht jetzt die Live-Versionen der gesamten managed Workflow-Familie gegeneinander.
- `scripts/check_workflow_template_drift.sh` prüft zusätzlich den `android-keystore-export` Endpoint in Live-Workflows und Diagnostics-Templates.
- `scripts/check_patch_docs_sync.sh` prüft zusätzlich, dass das Root-Analyseartefakt `WORKFLOW_SUPABASE_MD_DEEP_ANALYSE_2026-03-08.md` nicht mehr im Repo liegt.
- `lib/diagnostics/workflowTemplates.ts` auf denselben 405er Workflow-Stand gehoben.

## Ziel
Letzte Abschluss-Politur nach dem Deep-Review, damit Workflows, Drift-Guards, Endpoint-Assertions und Patch-Dokumentation wirklich zusammenpassen.
