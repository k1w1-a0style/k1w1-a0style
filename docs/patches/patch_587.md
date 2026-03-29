# Patch 587

## Ziel
Secret-Splitting fuer lokale Edge-Admin-Werte: kein stilles Spiegeln eines einzelnen lokalen Keys mehr in mehrere Repo-Secret-Zonen.

## Umsetzung
1. **TokenStore aufgetrennt**
   - Neue dedizierte SecureStore-Helper:
     - `get/save/deleteWorkflowAdminKey`
     - `get/save/deleteAndroidKeystoreExportAdminKey`
     - `get/save/deleteSigningAdminKey`
   - Legacy bleibt explizit als Compat erhalten:
     - `get/save/deleteEdgeAdminKey` (legacy)

2. **Repo Secret Sync entkoppelt**
   - `autoSyncRepoSecrets(...)` liest und synchronisiert getrennte lokale Werte:
     - `workflowAdminKey` -> `K1W1_EDGE_WORKFLOW_ADMIN_KEY`
     - `androidKeystoreExportAdminKey` -> `K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY`
     - `legacyEdgeAdminKey` -> `K1W1_EDGE_ADMIN_KEY`
     - `signingAdminKey` -> `SIGNING_ADMIN_KEY`
   - Kein Multi-Mirroring eines Einzelwerts mehr.

3. **Workflow-/Build-/Artifact-Caller auf dedizierten Workflow-Key**
   - `project/services/buildStartService.ts`
   - `project/services/buildPollingService.ts`
   - `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`
   - `hooks/useGitHubActionsLogs.ts`

4. **AppInfo Secret Backup/Import angepasst**
   - `SecretTokensSnapshotV1` und Mapping/Apply-Pfade auf getrennte Key-Zonen erweitert.
   - Legacy-Fallback (`tokens.edgeAdminKey`) bleibt nur fuer bestehende Backup-Kompatibilitaet erhalten.

5. **Secret-Helper-Script angepasst**
   - `scripts/signing_secrets.sh` erzeugt/setzt jetzt bewusst getrennte Key-Werte statt eines einzigen gespiegelt auf alle Secret-Namen.

## Verifikation (lokal)
- Gezielte Tests fuer TokenStore-/Build-/CI-Lite-/Logs-Vertrag
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
