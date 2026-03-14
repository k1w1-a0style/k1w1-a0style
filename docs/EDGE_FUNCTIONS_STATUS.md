# Edge Functions Status

Stand: 2026-03-14 (Patch 435)

## Aktiv und workflow-relevant

| Function | Zweck | Wichtige Outputs / Vertrag |
|---|---|---|
| `trigger-eas-build` | Legt `build_jobs` an und dispatcht GitHub `trigger-eas-build` | `jobId`, `githubRepo`, `branch`, `buildProfile` · Auth: Admin-Key oder CI-Bearer |
| `check-eas-build` | Liest `build_jobs` zurück | `status`, `runId`, `build_url`, `download_url`, `source_commit_sha`, `urls`, `artifact`, `job` · Auth: Admin-Key oder CI-Bearer |
| `github-workflow-dispatch` | Dispatch / Bootstrap managed Workflows | `ok`, `workflow`, `workflow_id`, optional `bootstrapped` · Auth: Admin-Key oder CI-Bearer |
| `github-workflow-runs` | Holt Workflow-Runs oder Repo-weiten Fallback | `data`, optional `note` bei Fallback · Auth: Admin-Key oder CI-Bearer |
| `github-workflow-logs` | Holt redigierte Logs eines Workflow-Runs | `run`, `files`, `fileCount`, `logsText`, `truncated` · Auth: Admin-Key oder CI-Bearer |
| `github-run-artifact-json` | Liest JSON-Datei aus GitHub Artifact-ZIP | `text`, `json`, `artifactId`, `artifactName`, `filePath` · Auth: Admin-Key oder CI-Bearer |
| `save_preview` / `preview_page` | Persistiert und rendert Browser-Previews | `previewUrl`, `expiresAt` (save) / HTML-Response + sichere Fehlerfälle (page) · Auth: admin-only (save), public secret-link (page) |
| `k1w1-handler` | KI-Provider-Proxy für produktive Chat-Calls | `ok`, `provider`, `model`, `content`, `raw` bzw. `ok:false,error` · Auth: Admin-Key |
| `android-keystore-export` | Liefert Android-Signing-Material für CI | `alias`, `keystoreBase64`, `keystorePassword`, `keyPassword` · Auth: Admin-Key oder CI-Bearer |

## Bewusst deaktiviert / Legacy

| Function | Status | Hinweis |
|---|---|---|
| `trigger-lint` | disabled | in `supabase/config.toml` deaktiviert; Stub liefert 410 / stillgelegt |
| `check-lint` | disabled | in `supabase/config.toml` deaktiviert; Stub liefert 410 / stillgelegt |
| `check-native-sync` | disabled | in `supabase/config.toml` deaktiviert; Stub liefert 410 / stillgelegt |
| `trigger-native-sync` | disabled | in `supabase/config.toml` deaktiviert; Stub liefert 410 / stillgelegt |
| `native-sync-report` | disabled | in `supabase/config.toml` deaktiviert; Stub liefert 410 / stillgelegt |
| `native-sync-report-ingest` | disabled | in `supabase/config.toml` deaktiviert; Stub liefert 410 / stillgelegt |

## Hinweise

- `release-build.yml` ist bewusst ein manueller Direktpfad und nicht dieselbe App-SoT wie `eas-build.yml`.
- `android-keystore-generate` und `android-keystore-status` bleiben bewusst admin-only, weil sie Wizard-/manuelle Keystore-Setup-Pfade sind.
- `github-workflow-dispatch` / `infra/github/workflowTemplates.ts` bilden weiterhin eine **partielle** Workflow-SoT ab (vor allem CI Lite), nicht die komplette managed Familie.
- `github-run-artifact-json` normalisiert ZIP-Pfade jetzt explizit inkl. `\`-Separatoren; dadurch bleiben Artifact-JSON-Lookups robust, auch wenn ZIP-Einträge nicht POSIX-normalisiert sind.
- Für operative Konsistenz nach Workflow- oder Edge-Änderungen zusätzlich ausführen:
  - `bash scripts/check_workflow_template_drift.sh`
  - `bash scripts/check_managed_workflows.sh`
  - `bash scripts/check_workflow_edge_contracts.sh`
