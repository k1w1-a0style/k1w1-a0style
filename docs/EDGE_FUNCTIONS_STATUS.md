# Edge Functions Status

Stand: **2026-04-02 (Docs Konsolidierung)**

## Aktiv und workflow-relevant

| Function | Zweck | Wichtige Outputs / Vertrag |
|---|---|---|
| `trigger-eas-build` | Legt `build_jobs` an und dispatcht GitHub `trigger-eas-build` | `jobId`, `githubRepo`, `branch`, `buildProfile` · Request-Contract: `branch` ist serverseitig verpflichtend (fehlend/leer/Whitespace => 400) · Auth: **JWT + Claim + Scoped Secret** (`verify_jwt=true`, `role in [service_role, build_admin]`, `x-k1w1-admin-key`, Secret `K1W1_EDGE_WORKFLOW_ADMIN_KEY`) |
| `check-eas-build` | Liest `build_jobs` zurück | `status`, `runId`, `build_url`, `download_url`, `source_commit_sha`, `urls`, `artifact`, `job` · Auth: **JWT + Claim + Scoped Secret** (`verify_jwt=true`, `role in [service_role, build_admin]`, `x-k1w1-admin-key`, Secret `K1W1_EDGE_WORKFLOW_ADMIN_KEY`) |
| `github-workflow-dispatch` | Reiner Workflow-Dispatch (mutation-free) | `ok`, `workflow`, `workflow_id`; bei fehlendem Workflow klarer `missing_workflow`-Fehler (kein impliziter Bootstrap/Repo-Write) · Auth: **JWT + Claim + Scoped Secret** (`verify_jwt=true`, `role in [service_role, build_admin]`, `x-k1w1-admin-key`, Secret `K1W1_EDGE_WORKFLOW_ADMIN_KEY`) |
| `github-workflow-runs` | Holt Workflow-Runs (fail-closed bei ungültigem `workflowId`) | `data` · Auth: **JWT + Claim + Scoped Secret** (`verify_jwt=true`, `role in [service_role, build_admin]`, `x-k1w1-admin-key`, Secret `K1W1_EDGE_WORKFLOW_ADMIN_KEY`) · Policy: liest nur Repos aus `K1W1_ALLOWED_GITHUB_REPOS` |
| `github-workflow-logs` | Holt redigierte Logs eines Workflow-Runs | `run`, `files`, `fileCount`, `logsText`, `truncated` · Auth: **JWT + Claim + Scoped Secret** (`verify_jwt=true`, `role in [service_role, build_admin]`, `x-k1w1-admin-key`, Secret `K1W1_EDGE_WORKFLOW_ADMIN_KEY`) · Policy: liest nur Repos aus `K1W1_ALLOWED_GITHUB_REPOS` |
| `github-run-artifact-json` | Liest JSON-Datei aus GitHub Artifact-ZIP | `text`, `json`, `artifactId`, `artifactName`, `filePath` · Auth: **JWT + Claim + Scoped Secret** (`verify_jwt=true`, `role in [service_role, build_admin]`, `x-k1w1-admin-key`, Secret `K1W1_EDGE_WORKFLOW_ADMIN_KEY`) · Policy: liest nur Repos aus `K1W1_ALLOWED_GITHUB_REPOS` |
| `save_preview` / `preview_page` | Persistiert und rendert Browser-Previews | `previewUrl`, `expiresAt` (save) / HTML-Response + sichere Fehlerfälle (page) · Auth: `save_preview` nutzt jetzt **verifiziertes Supabase-Login-JWT** (`verify_jwt=true`, `requireVerifiedJwt(...)`, kein lokaler Legacy-Admin-Key mehr), `preview_page` bleibt bewusst `verify_jwt=false` als Secret-Gate-Sonderpfad (Fragment-Link + Header-Handoff, Secret-Format-Guard, TTL/Expiry-Delete, durable Rate-Limit) |
| `k1w1-handler` | KI-Provider-Proxy für produktive Chat-Calls | `ok`, `provider`, `model`, `content`, optional `runtime_note` bzw. `ok:false,error,code,status` · Auth: **JWT + Claim** (`verify_jwt=true`, `role in [service_role, build_admin]`, `Authorization: Bearer <jwt>`, kein lokaler Legacy-Admin-Key mehr) |
| `create_codesandbox` | Legacy-/Compat-Pfad, nicht mehr Teil der aktiven Produktoberflaeche | Immer `410 legacy_create_codesandbox_disabled` · in `supabase/config.toml` deaktiviert |
| `android-keystore-export` | Liefert Android-Signing-Material für CI | `alias`, `keystoreBase64`, `keystorePassword`, `keyPassword` · Auth: **JWT + Claim + Scoped Secret** (`verify_jwt=true`, `role in [service_role]`, `x-k1w1-admin-key`, Secret `K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY`) |
| `android-keystore-generate` | Generiert/signiert Android-Keystore-Material serverseitig (branch-unabhaengig, Scope `repo + mode`) | `ok`, `repo`, `mode`, `alias`, `bucket`, `path` · Auth: **JWT + Claim + Scoped Secret** (`verify_jwt=true`, `role in [service_role, build_admin]`, `x-k1w1-admin-key`, Secret `K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY`) |
| `android-keystore-status` | Liefert Keystore-Record-/Storage-Status für Repo/Mode | `ok`, `exists`, optional `record` · Auth: **JWT + Claim + Scoped Secret** (`verify_jwt=true`, `role in [service_role, build_admin]`, `x-k1w1-admin-key`, Secret `K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY`) |
| `test` | Legacy-Testroute (stray/stub) | bewusst fail-closed: scoped Legacy-Guard `requireScopedEdgeAuth(... scope: "test", adminSecretEnv: "K1W1_EDGE_ADMIN_KEY", allowAdmin: true)` und danach immer `410` mit `code: legacy_test_route_disabled` |

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
- `android-keystore-export` bleibt die Referenz fuer den dedizierten Keystore-Secret-Scope und ist JWT-seitig bewusst enger (`service_role` only); `android-keystore-generate` und `android-keystore-status` nutzen denselben scoped Secret-Pfad mit JWT-RBAC `service_role|build_admin`.
- Der build_admin-Claim wird nicht im Repo erzeugt: `requireJwtRole(...)` priorisiert nach erfolgreicher Verifikation den Rollenwert aus dem verifizierten JWT-Claim (`role`, danach `app_metadata.role`) und nutzt `GET /auth/v1/user` nur noch defensiv als Fallback; damit bleibt der externe `build_admin`-Provisioning-Vertrag erhalten, ohne `user.role=authenticated`-Drift.
- Patch 622 schliesst den verbleibenden Live-Decode-Drift im selben Pfad: JWT-Payload-Decoding ist jetzt UTF-8-sicher (`TextDecoder`), damit ein valider `build_admin`-Claim nicht durch Non-ASCII-Nebenclaims im Token verloren geht und der finale `allowedRoles`-Vergleich (`service_role|build_admin`) in Workflow-/Keystore-Operatorrouten stabil greift.
- Patch 597 zieht den App-Caller-Vertrag des Credentials Wizards final nach: Requests an `android-keystore-status`/`android-keystore-generate` laufen nur noch mit `Authorization: Bearer <Supabase user JWT>` **und** `x-k1w1-admin-key` (lokaler `androidKeystoreExportAdminKey`).
- Patch 598 reduziert den verbleibenden generischen Legacy-Guard-Scope: `requireAdminKey(...)` akzeptiert nur noch `K1W1_EDGE_ADMIN_KEY` (kein stiller `SIGNING_ADMIN_KEY`-Fallback). Historisch betraf das u.a. `create_codesandbox`, `save_preview` und disabled lint/native-sync Stubs; der **aktuelle** Vertragsstand ist aber: `create_codesandbox` ist jetzt als Legacy-/Compat-Pfad deaktiviert (`enabled = false`, `410 legacy_create_codesandbox_disabled`); `save_preview` bleibt der JWT-geschuetzte Standardpfad.
- Fix-Durchlauf 2 zieht `k1w1-handler` auf denselben fail-closed JWT-/RBAC-Grundvertrag wie andere privilegierte Operatorpfade: `verify_jwt=true`, `Authorization: Bearer <jwt>` serverseitig `requireAiOperatorJwtRole(...)` fuer `service_role|build_admin`, ohne lokalen Legacy-Key-Zwang.
- Fix-Durchlauf 2 zieht ausserdem die Workflow-Read-Pfade (`github-workflow-runs`, `github-workflow-logs`, `github-run-artifact-json`) auf dieselbe Repo-Allowlist wie Dispatch/Build; Reads ausserhalb von `K1W1_ALLOWED_GITHUB_REPOS` werden jetzt fail-closed mit `403 githubRepo not allowed` abgewiesen.
- Patch 599 beseitigt den aktuellen Keystore-Config-Split-Brain: die funktionslokalen Config-Dateien fuer `android-keystore-status`/`android-keystore-generate` wurden entfernt, damit `supabase/config.toml` als einzige fail-closed SoT (`verify_jwt=true`) gilt und kein lokaler `verify_jwt=false`-Schattenzustand mehr existiert.
- Patch 608 zieht den finalen Keystore-Config-SoT-Cleanup fuer `android-keystore-export` nach: die redundante lokale Datei `supabase/functions/android-keystore-export/config.toml` ist entfernt, damit fuer `export`/`generate`/`status` derselbe eindeutige Endvertrag gilt (einzige SoT `supabase/config.toml`, `verify_jwt=true`, kein lokaler Split-Brain-Pfad).
- Operativer Hinweis (Live-Drift): `scripts/check_edge_live_contracts.sh` validiert Laufzeitverhalten, nicht direkt Dashboard-Flags. Der explizite Flag-Audit ist fuer den aktuellen Stand bereits erfolgt (`save_preview` + `k1w1-handler` live auf `verify_jwt=true` bestaetigt); fuer kuenftige Releases bleibt der erneute Abgleich sinnvoll.
- Patch 601 behandelt die stray Legacy-Testroute `test` explizit fail-closed (scoped Guard + `410 legacy_test_route_disabled`) und sichert den Vertrag in Invariants/Script-Checks mit ab.
- Patch 602 zieht den lokalen Smoke-Caller-Vertrag auf denselben Edge-Vertrag: `scripts/ci-lite-smoke.sh` sendet fuer `github-workflow-dispatch`/`github-workflow-runs`/`github-workflow-logs` jetzt immer `Authorization: Bearer <K1W1_EDGE_WORKFLOW_JWT>` plus `x-k1w1-admin-key: <K1W1_EDGE_WORKFLOW_ADMIN_KEY>` und verlangt einen expliziten `<ref>` (kein stilles `main`).
- Patch 604 zieht die App-Caller-/Wizard-Kommunikation auf denselben Operator-Vertrag: app-initiierte workflow-/build-/artifact-/keystore-Calls benoetigen weiterhin `Authorization: Bearer <jwt>` + scoped Admin-Key, aber der JWT muss serverseitig `service_role|build_admin` erfuellen; lokale Fehltexte nennen daher kein `role=authenticated` mehr.
- Patch 605 schliesst den operativen Restvertrag: im Repo existiert kein interner build_admin-Mapper/Grant-Flow; fuer produktive Operator-Nutzung muss der Claim extern provisioniert sein, bevor App-/Wizard-Caller diese Routen nutzen.
- Patch 611 zieht den finalen Operator-Runbook-/Preflight-Vertrag nach: fuer workflow-/build-/artifact-/keystore-Operatorpfade sind normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim kein Repo-Bug, sondern bewusst fail-closed blockiert; Caller-Texte, Diagnostics und Checks benennen diesen externen Betriebsvertrag jetzt einheitlich.
- Patch 613 trennt Dispatch und Bootstrap/Repair hart: `github-workflow-dispatch` dispatcht nur noch und mutiert das Ziel-Repo nicht implizit mehr bei `404`; fehlende Workflows werden als `missing_workflow` signalisiert und muessen ueber explizite Repair-/Provisioning-Flows behoben werden.
- Patch 603 schliesst eine echte Guard-Misconfiguration der Legacy-Testroute: `supabase/functions/test` setzt jetzt explizit `allowAdmin: true` + `scope: "test"` im `requireScopedEdgeAuth(...)`-Aufruf, damit der Pfad nicht mehr vorzeitig in `500` (`Auth misconfiguration`) endet, sondern konsistent fail-closed `410 legacy_test_route_disabled` liefert; Script-Check und Invariants pruefen diese konkrete Konfiguration explizit mit.
- `github-workflow-dispatch` / `infra/github/workflowTemplates.ts` bilden weiterhin eine **partielle** Workflow-SoT ab (vor allem CI Lite), nicht die komplette managed Familie.
- `github-run-artifact-json` normalisiert ZIP-Pfade jetzt explizit inkl. `\`-Separatoren; dadurch bleiben Artifact-JSON-Lookups robust, auch wenn ZIP-Einträge nicht POSIX-normalisiert sind.
- `github-run-artifact-json` folgt jetzt derselben kontrollierten Workflow-Linie wie Dispatch/Runs/Logs/Build: JWT-Claim-Guard fuer `service_role|build_admin` plus scoped Workflow-Admin-Key; ein separater CI-bearer-Sonderpfad ist entfernt.
- Für operative Konsistenz nach Workflow- oder Edge-Änderungen zusätzlich ausführen:
  - `bash scripts/check_workflow_template_drift.sh`
  - `bash scripts/check_managed_workflows.sh`
  - `bash scripts/check_workflow_edge_contracts.sh`

- App-seitig gibt es aktuell weiterhin einen lokalen Edge-Admin-Key im SecureStore. Wenn du Workflows/Logs/Dispatch aus der App startest, muss dieser lokale Wert zum serverseitigen Workflow-Admin-Secret passen.


## Operative Reihenfolge (Runbook-Kurzfassung)

1. Externen Operator-Claim (`build_admin`) fuer den Testuser provisionieren.
2. Lokale scoped Keys setzen (Workflow vs. Keystore getrennt).
3. Supabase- und GitHub-Secrets sowie DB-/Storage-Objekte fuer Build/Signing/Preview verifizieren.
4. Erst danach Repair-/Provisioning-Flows (falls noetig) und normalen Dispatch/Build starten.
5. Legacy-/Compat-Pfade (`create_codesandbox`, lokale Alt-Admin-Keys) nie als Standard-Produktpfad interpretieren; `save_preview` ist jetzt wieder ein JWT-geschuetzter Standardpfad, und `k1w1-handler` verlangt einen Operator-JWT.

Dieser Vertrag ist bewusst darauf ausgelegt, Setup-Luecken als Setup-Luecken sichtbar zu machen statt als scheinbaren Code-Defekt.
