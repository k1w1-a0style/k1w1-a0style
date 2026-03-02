# 14 — State Quick Reference

Stand: 2026-03-02

## 1) Source of Truth (SoT)
- **Global Project-SoT:** `projectData` in `ProjectContext`.
- Autoritative Auswahlwerte:
  - `projectData.linkedRepo`
  - `projectData.linkedBranch`
  - `projectData.preferredBuildProfile`
- `GitHubContext.activeRepo/activeBranch` sind Mirror-States für UX, nicht primärer SoT.

## 2) Persistente Keys (AsyncStorage)
Quelle: `lib/storageKeys.ts`

### Selection/Connection
- `eas_project_id`
- `conn_github_ok`, `conn_github_user`, `conn_github_scopes`
- `conn_expo_ok`, `conn_expo_user`
- `conn_supabase_ok`, `conn_supabase_ref`
- `conn_eas_ok`, `conn_repo_ok`, `conn_repo_slug`, `conn_repo_branch`
- `recent_branches_by_repo`

### Build/Diagnostics
- `diagnostic_last_ok`
- `cred_key_exists_dev`, `cred_key_exists_preview`, `cred_key_exists_production`
- `ci_lite_lint_ok`, `ci_lite_typecheck_ok`, `ci_lite_last_run_at`
- `k1w1_build_history`
- `one_click_auto_sync_secrets`

### Settings / Privacy
- `k1w1_chat_persist_history`
- `k1w1_chat_retention_limit`

### Legacy/Migration-sensitive
- `supabase_service_role_key` ist als Legacy-Key benannt; Service Role wird Richtung SecureStore migriert.

## 3) Ephemeral (nicht persistent)
- Laufende UI-Busy/Modal/Selection States in Screen-Hooks (z. B. Diagnostic Filter, open sheets).
- Temporäre Polling-States im Buildscreen.
- Terminal log runtime state (nur in Session, sofern nicht separat exportiert).

## 4) State Contract Kurzregeln
1. Repo/Branch immer über `projectData.linked*` als Business-SoT behandeln.
2. Build-Gate liest `diagnostic_last_ok` + signing/token prerequisites.
3. Keine stillen Branch-Erfindungen im Buildstart.
4. Mirror-State darf UX verbessern, aber nicht SoT überschreiben ohne Intent.

## 5) Tests / Invariants
- String-Invariants für zentrale Keys: `__tests__/invariants.strings.test.ts`.
- Build-Gate Verhalten: Tests rund um `buildStartService`/preconditions.

## 6) Backup/Migration Hinweise
- Projektblob wird über Projekt-Persistenz geladen/gespeichert (`k1w1_project_data`).
- Import/Export-Flows können linked Repo/Branch aktualisieren; danach immer Diagnostics/Buildscreen kurz rechecken.
