# 14 — State Quick Reference (SoT + Persistenz)

Stand: **2026-04-23 (Prompt-6 Contract-Cleanup)**

## 1) Source of Truth pro Domäne

| Domäne | SoT | Mirror / Derived | Hinweise |
|---|---|---|---|
| Repo/Branch/Profile | `ProjectContext.projectData` (`linkedRepo`, `linkedBranch`, `preferredBuildProfile`) | `GitHubContext.activeRepo/activeBranch` | `active*` ist rein abgeleitet aus `projectData.linked*` (keine eigene Persistenz) |
| Build-Start | `ProjectContext.startBuild` + `startBuildJob` | Build UI states (`useEnhancedBuildScreen`) | Gate: Branch vorhanden + selection-scoped `diagnostic_last_ok::<repo>::<branch>=true` + Repo-Sync-Status bekannt (`in_sync` oder `out_of_sync`) |
| Diagnostics Status | AsyncStorage `diagnostic_last_ok::<repo>::<branch>` + letzte Reports im Screen-State | Header counts / issue filter | Wird selection-scoped von Diagnose geschrieben und selection-scoped vom Build gelesen; Selection-Wechsel invalidiert stale Resultate im Screen |
| Build-Logs-Kontext | `currentBuild.githubRepo` + `currentBuild.runId` | `LogsAnalysisSection`, `BuildLogsModal` | Bei aktivem Lauf keine `latest`-Fallbacks mehr auf die aktuelle Selection; ohne `runId` nur Pending-Hinweis |
| Chat-Blur-Cleanup | `handleScreenBlurCleanup()` in `useChatAIFlow` | Systemnachricht im Chat | Blur abortet aktive Requests sichtbar; vorhandene `pendingPlan`/`pendingChange` bleiben erhalten |
| ZIP-Import-Normalisierung | `normalizeLoadedProjectData()` | `ProjectContext.importProjectFromZip()` | Importierte Projekte laufen vor Persistenz durch denselben Normalisierungspfad wie geladene Projekte |
| Preview-Fullscreen | aktive `previewSource` | Preview Toolbar / `PreviewFullscreen` | Fullscreen nur noch aktiv, wenn eine gültige URL-/HTML-Quelle wirklich nutzbar ist |
| Connections | Token storage/services + `STORAGE_KEYS.CONN_*` | Lampen/Badges in Connections/GitHub Repos | Nur positiv getestete Zustände als `*_ok` |

## 2) Persistente Keys (Quickref)

### Aus `lib/storageKeys.ts`
- Supabase/Legacy: `supabase_raw` (**kanonische SoT**: Ref oder normalisierte URL), `supabase_url` (**nur Mirror/Compat aus `supabase_raw` abgeleitet, keine zweite Wahrheit**), `supabase_key`, `supabase_service_role_key` (legacy)
- Connection: `conn_github_ok`, `conn_github_user`, `conn_github_scopes`, `conn_expo_ok`, `conn_expo_user`, `conn_supabase_ok`, `conn_supabase_ref`, `conn_eas_ok`
- Repo-Connection: `conn_repo_ok`, `conn_repo_slug`, `conn_repo_branch`, `recent_branches_by_repo`
- Diagnostics/Build: `diagnostic_last_ok` (legacy global nur noch historisch), `diagnostic_last_ok::<repo>::<branch>` (kanonisch fuer aktive Selection), `ci_lite_lint_ok`, `ci_lite_typecheck_ok`, `ci_lite_last_run_at`, `k1w1_build_history`, `repo_sync_signature::<repo>::<branch>`
- Signing/Profile: `cred_key_exists_dev`, `cred_key_exists_preview`, `cred_key_exists_production`
- UX/Settings: `k1w1_chat_persist_history`, `k1w1_chat_retention_limit`, `one_click_auto_sync_secrets`, `eas_project_id`

### Aus `shared/constants/github.ts` (GitHubContext)
- `k1w1_github_recent_repos`
- `k1w1_github_active_repo` *(legacy, wird nicht mehr als SoT geschrieben)*
- `k1w1_github_active_branch` *(legacy, wird nicht mehr als SoT geschrieben)*

## 3) Ephemeral State (nur RAM)
- Diagnose UI-State: Filter, offene Issue-Details, laufender Busy-Status.
- Build UI-State: Polling/Modal/Progress-Komponenten.
- Temporäre Screen-Selections und Toasts.

## 4) Migration / Backups
- `supabase_service_role_key` ist als Legacy-AsyncStorage-Key markiert; Ziel ist SecureStore-Nutzung.
- Projektdaten werden als Projekt-Blob geladen/gespeichert (über Projekt-Persistenz in `infra/storage/projectPersistence`).
- Import/Export-Flows können `linkedRepo/linkedBranch` ändern; danach immer Diagnostics + Build-Preconditions neu prüfen.
- ZIP-Importe werden vor Persistenz normalisiert (`slug`, `files`, `chatHistory`, `preferredPreviewMode`).
- Chat-Blur räumt aktive Requests auf, ohne vorhandene Plan-/Änderungsstände blind zu verwerfen.
- Preview-Fullscreen folgt nur aktiven, validen Preview-Quellen und nicht bloß historischen Metadaten.

## 5) Persistenz-Tests / Invariants
- `__tests__/invariants.strings.test.ts`: zentrale String-/Key-Invarianten.
- `__tests__/buildReadiness.assert.test.ts`: Gate-Invarianten (`ERR_BRANCH_MISSING`, `ERR_DIAGNOSTIC_NOT_GREEN`).
- `__tests__/buildStartService.startBuildJob.test.ts`: StartBuild Job-Verhalten inkl. Guardrails.

Siehe ausführlich: `docs/01-state-contract.md`.
