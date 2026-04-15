# Patch 780: Recoverability state-complete closure for Connections + Secure-Backup Import

## Ziel
Verbleibende echte Restfehler im aktuellen Kern-Fixblock schließen:
- Connections-Save-Rollback muss neben Primaerwerten auch fachlich relevante Neben-/Marker-/Light-/UI-States vollstaendig wiederherstellen.
- Secure-Backup-Import-Rollback muss zusaetzlich die durch `resetDerivedStatusAfterSecretImport()` geloeschten Derived-/Statuspfade wiederherstellen.
- Pending-Journal-Recovery muss fuer beide Flows state-complete sein.
- Statusnahe Doku muss den Stand semantisch ehrlich spiegeln.

## Umsetzung (eng, ohne Broad-Refactor)

### 1) Connections: Side-State-Abdeckung auf vollstaendigen mutierten Umfang erweitert
- `ConnectionsSnapshot.sideState` deckt jetzt auch GitHub-/Expo-/Repo-Marker ab (`CONN_GITHUB_*`, `CONN_EXPO_*`, `CONN_REPO_*`) zusaetzlich zu Supabase/EAS.
- Restore schreibt die Marker in AsyncStorage zurueck **und** setzt die entsprechenden In-Memory/UI-States via neue Callbacks (`setGitHubConnectionState`, `setExpoConnectionState`, `setRepoConnectionState`).
- Ergebnis: fehlgeschlagene Saves hinterlassen keinen Mischzustand mehr aus alten Primaerwerten und neuen Marker-/UI-States.

### 2) Secure-Backup-Import: Derived/Status-Reset jetzt recoverable
- Neuer Snapshot vor Import-Apply: `snapshotDerivedStatusBeforeSecretImport()` erfasst alle Keys, die `resetDerivedStatusAfterSecretImport()` loescht.
- Neuer Restore fuer Rollback/Journal-Recovery: `restoreDerivedStatusAfterSecretImportRollback(...)` stellt vorhandene Keys wieder her und entfernt Keys, die im Snapshot nicht existierten.
- `runSecureBackupImport(...)` nutzt jetzt `SecureBackupImportSnapshot` (`secrets` + `derivedStatus`) fuer `runRecoverableCommit(...)` und `recoverFromPendingJournal(...)`.
- Ergebnis: fehlgeschlagene Imports verlieren keine abgeleiteten Status-/Marker-/Diagnostics-/CI-lite-/Credential-Informationen mehr.

## Tests
- Erweiterte Invariants fuer Flow-Abdeckung:
  - `__tests__/connectionsAndBackupRecoverable.invariants.test.ts`
- Erweiterter Runtime-Test fuer Derived-Status-Snapshot/Restore:
  - `__tests__/appInfoSecretImportStatusReset.test.ts`

## Verifikation (Patch-Block)
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `npm run typecheck:edge`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_eas_manual_trigger_controls.sh`
- `bash scripts/check_eas_production_credentials.sh`
- `bash scripts/check_eas_strict_lockfile_policy.sh`
- `bash scripts/check_edge_helper_visibility.sh`
- `bash scripts/check_k1w1_handler_providers.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `bash scripts/check_supabase_deploy_workflow.sh`
- `npm run test:silent -- --runInBand edgeHelperVisibility.invariants.test.ts`
- `npm run test:silent -- --runInBand k1w1Handler.providers.invariants.test.ts`

## Ergebnis
Der Kern-Fixblock ist im geforderten Scope state-complete geschlossen: Connections-Save und Secure-Backup-Import sind fuer ihren realen Mutationsumfang recoverable, inklusive Pending-Journal-Recovery fuer die mutierten Nebenstates.
