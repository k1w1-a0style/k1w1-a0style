# Edge Functions Status

Stand: 2026-03-28 (Patch 599)

## Aktiv und workflow-relevant

| Function | Zweck | Wichtige Outputs / Vertrag |
|---|---|---|
| `trigger-eas-build` | Legt `build_jobs` an und dispatcht GitHub `trigger-eas-build` | `jobId`, `githubRepo`, `branch`, `buildProfile` · Request-Contract: `branch` ist serverseitig verpflichtend (fehlend/leer/Whitespace => 400) · Auth: **JWT + Claim + Scoped Secret** (`verify_jwt=true`, `role in [service_role, build_admin]`, `x-k1w1-admin-key`, Secret `K1W1_EDGE_WORKFLOW_ADMIN_KEY`) |
| `check-eas-build` | Liest `build_jobs` zurück | `status`, `runId`, `build_url`, `download_url`, `source_commit_sha`, `urls`, `artifact`, `job` · Auth: **JWT + Claim + Scoped Secret** (`verify_jwt=true`, `role in [service_role, build_admin]`, `x-k1w1-admin-key`, Secret `K1W1_EDGE_WORKFLOW_ADMIN_KEY`) |
| `github-workflow-dispatch` | Dispatch / Bootstrap managed Workflows | `ok`, `workflow`, `workflow_id`, optional `bootstrapped` · Auth: **JWT + Claim + Scoped Secret** (`verify_jwt=true`, `role in [service_role, build_admin]`, `x-k1w1-admin-key`, Secret `K1W1_EDGE_WORKFLOW_ADMIN_KEY`) |
| `github-workflow-runs` | Holt Workflow-Runs (fail-closed bei ungültigem `workflowId`) | `data` · Auth: **JWT + Claim + Scoped Secret** (`verify_jwt=true`, `role in [service_role, build_admin]`, `x-k1w1-admin-key`, Secret `K1W1_EDGE_WORKFLOW_ADMIN_KEY`) |
| `github-workflow-logs` | Holt redigierte Logs eines Workflow-Runs | `run`, `files`, `fileCount`, `logsText`, `truncated` · Auth: **JWT + Claim + Scoped Secret** (`verify_jwt=true`, `role in [service_role, build_admin]`, `x-k1w1-admin-key`, Secret `K1W1_EDGE_WORKFLOW_ADMIN_KEY`) |
| `github-run-artifact-json` | Liest JSON-Datei aus GitHub Artifact-ZIP | `text`, `json`, `artifactId`, `artifactName`, `filePath` · Auth: **JWT + Claim + Scoped Secret** (`verify_jwt=true`, `role in [service_role, build_admin]`, `x-k1w1-admin-key`, Secret `K1W1_EDGE_WORKFLOW_ADMIN_KEY`) |
| `save_preview` / `preview_page` | Persistiert und rendert Browser-Previews | `previewUrl`, `expiresAt` (save) / HTML-Response + sichere Fehlerfälle (page) · Auth: `save_preview` nutzt jetzt explizit `requireScopedEdgeAuth(... adminSecretEnv: "K1W1_EDGE_ADMIN_KEY", allowCiBearer: false)`, `preview_page` bleibt public secret-link |
| `k1w1-handler` | KI-Provider-Proxy für produktive Chat-Calls | `ok`, `provider`, `model`, `content`, `raw` bzw. `ok:false,error` · Auth: expliziter legacy-scoped Admin-Guard `requireScopedEdgeAuth(... adminSecretEnv: "K1W1_EDGE_ADMIN_KEY", allowCiBearer: false)` |
| `create_codesandbox` | Erzeugt browserfaehige CodeSandbox-Preview | `ok`, `sandboxUrl`/API-Result oder strukturierter Fehler · Auth: expliziter legacy-scoped Admin-Guard `requireScopedEdgeAuth(... adminSecretEnv: "K1W1_EDGE_ADMIN_KEY", allowCiBearer: false)` |
| `android-keystore-export` | Liefert Android-Signing-Material für CI | `alias`, `keystoreBase64`, `keystorePassword`, `keyPassword` · Auth: **JWT + Claim + Scoped Secret** (`verify_jwt=true`, `role=service_role`, `x-k1w1-admin-key`, Secret `K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY`) |
| `android-keystore-generate` | Generiert/signiert Android-Keystore-Material serverseitig (branch-unabhaengig, Scope `repo + mode`) | `ok`, `repo`, `mode`, `alias`, `bucket`, `path` · Auth: **JWT + Claim + Scoped Secret** (`verify_jwt=true`, `role in [service_role, build_admin]`, `x-k1w1-admin-key`, Secret `K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY`) |
| `android-keystore-status` | Liefert Keystore-Record-/Storage-Status für Repo/Mode | `ok`, `exists`, optional `record` · Auth: **JWT + Claim + Scoped Secret** (`verify_jwt=true`, `role in [service_role, build_admin]`, `x-k1w1-admin-key`, Secret `K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY`) |

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

- Edge-Eingang `trigger-eas-build` ist ab Patch 589 fail-closed auf expliziten `branch` gehaertet (kein still tolerierter leerer/missing Branch mehr am Route-Request).
- Patch 590 zieht die tieferen branch-nahen Infra-Pfade nach: `infra/github/workflows.ts`, `infra/github/files.ts` und `infra/github/branchOps.ts` raten nicht mehr auf `"main"`, sondern brechen bei fehlendem Branch/Ref bzw. fehlendem `default_branch` fail-closed ab.
- Patch 591 bereinigt den Keystore-Generate-Vertrag: `android-keystore-generate` erwartet/antwortet kein `branch` mehr; Route bleibt absichtlich branch-unabhaengig auf `repo + mode`.
- `release-build.yml` ist bewusst ein manueller Direktpfad und nicht dieselbe App-SoT wie `eas-build.yml`.
- `android-keystore-export` bleibt die Referenz fuer den dedizierten Keystore-Secret-Scope; `android-keystore-generate` und `android-keystore-status` nutzen jetzt denselben scoped Secret-Pfad plus fail-closed JWT-RBAC (`service_role|build_admin`).
- Patch 597 zieht den App-Caller-Vertrag des Credentials Wizards final nach: Requests an `android-keystore-status`/`android-keystore-generate` laufen nur noch mit `Authorization: Bearer <Supabase user JWT>` **und** `x-k1w1-admin-key` (lokaler `androidKeystoreExportAdminKey`).
- Patch 598 reduziert den verbleibenden generischen Legacy-Guard-Scope: `requireAdminKey(...)` akzeptiert nur noch `K1W1_EDGE_ADMIN_KEY` (kein stiller `SIGNING_ADMIN_KEY`-Fallback), und die verbliebenen Legacy-Routen (`k1w1-handler`, `create_codesandbox`, `save_preview` sowie disabled lint/native-sync Stubs) sind auf explizite `requireScopedEdgeAuth(... adminSecretEnv: "K1W1_EDGE_ADMIN_KEY")`-Vertraege gezogen.
- Patch 599 beseitigt den aktuellen Keystore-Config-Split-Brain: die funktionslokalen Config-Dateien fuer `android-keystore-status`/`android-keystore-generate` wurden entfernt, damit `supabase/config.toml` als einzige fail-closed SoT (`verify_jwt=true`) gilt und kein lokaler `verify_jwt=false`-Schattenzustand mehr existiert.
- `github-workflow-dispatch` / `infra/github/workflowTemplates.ts` bilden weiterhin eine **partielle** Workflow-SoT ab (vor allem CI Lite), nicht die komplette managed Familie.
- `github-run-artifact-json` normalisiert ZIP-Pfade jetzt explizit inkl. `\`-Separatoren; dadurch bleiben Artifact-JSON-Lookups robust, auch wenn ZIP-Einträge nicht POSIX-normalisiert sind.
- `github-run-artifact-json` folgt jetzt derselben kontrollierten Workflow-Linie wie Dispatch/Runs/Logs/Build: JWT-Claim-Guard fuer `service_role|build_admin` plus scoped Workflow-Admin-Key und CI-Bearer-Sonderpfad nur fuer explizite CI-Aufrufe.
- Für operative Konsistenz nach Workflow- oder Edge-Änderungen zusätzlich ausführen:
  - `bash scripts/check_workflow_template_drift.sh`
  - `bash scripts/check_managed_workflows.sh`
  - `bash scripts/check_workflow_edge_contracts.sh`

- App-seitig gibt es aktuell weiterhin einen lokalen Edge-Admin-Key im SecureStore. Wenn du Workflows/Logs/Dispatch aus der App startest, muss dieser lokale Wert zum serverseitigen Workflow-Admin-Secret passen.
