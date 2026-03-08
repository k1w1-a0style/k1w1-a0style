# Edge Functions Status

Stand: 2026-03-08 (Patch 406)

## Aktiv und workflow-relevant

| Function | Zweck | Wichtige Outputs / Vertrag |
|---|---|---|
| `trigger-eas-build` | Legt `build_jobs` an und dispatcht GitHub `trigger-eas-build` | `jobId`, `githubRepo`, `branch`, `buildProfile` |
| `check-eas-build` | Liest `build_jobs` zurück | `status`, `runId`, `build_url`, `download_url`, `source_commit_sha`, `urls`, `artifact`, `job` |
| `github-workflow-dispatch` | Dispatch / Bootstrap managed Workflows | `ok`, `workflow`, `workflow_id`, optional `bootstrapped` |
| `github-workflow-runs` | Holt Workflow-Runs oder Repo-weiten Fallback | `data`, optional `note` bei Fallback |
| `github-workflow-logs` | Holt redigierte Logs eines Workflow-Runs | `run`, `files`, `fileCount`, `logsText`, `truncated` |
| `github-run-artifact-json` | Liest JSON-Datei aus GitHub Artifact-ZIP | `text`, `json`, `artifactId`, `artifactName`, `filePath` |
| `android-keystore-export` | Liefert Android-Signing-Material für CI | `alias`, `keystoreBase64`, `keystorePassword`, `keyPassword` |

## Bewusst deaktiviert / Legacy

| Function | Status | Hinweis |
|---|---|---|
| `trigger-lint` | disabled | liefert 410 / stillgelegt |
| `check-lint` | disabled | liefert 410 / stillgelegt |
| `check-native-sync` | disabled | liefert 410 / stillgelegt |
| `trigger-native-sync` | disabled | liefert 410 / stillgelegt |
| `native-sync-report` | disabled | liefert 410 / stillgelegt |
| `native-sync-report-ingest` | disabled | liefert 410 / stillgelegt |

## Hinweise

- `release-build.yml` ist bewusst ein manueller Direktpfad und nicht dieselbe App-SoT wie `eas-build.yml`.
- `github-workflow-dispatch` / `infra/github/workflowTemplates.ts` bilden weiterhin eine **partielle** Workflow-SoT ab (vor allem CI Lite), nicht die komplette managed Familie.
- Für operative Konsistenz nach Workflow- oder Edge-Änderungen zusätzlich ausführen:
  - `bash scripts/check_workflow_template_drift.sh`
  - `bash scripts/check_managed_workflows.sh`
  - `bash scripts/check_workflow_edge_contracts.sh`
