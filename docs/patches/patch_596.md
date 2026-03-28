# Patch 596: Scoped-Key-Vertrag fuer Connections/Secrets/Diagnostics konsolidiert

## Ziel
Der naechste UI-/Diagnostik-Konsolidierungsschritt zieht Settings-/Connections-/Secrets-UI und Build-Diagnostics auf denselben scoped-key-Vertrag:
- getrennte lokale Keys fuer Workflow vs. Android-Keystore-Export,
- Legacy-Key nur noch als klar markierte Compat-Linie,
- keine irrefuehrenden Spiegel-Texte eines einzelnen lokalen Edge-Keys,
- Diagnostics ohne false-green bei nur vorhandenem Legacy-Key.

## Umsetzung

1. **Connections UI + Hook auf scoped lokale Keys umgestellt**
   - `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`
     - laedt/speichert jetzt getrennt:
       - `workflowAdminKey` (`get/save/deleteWorkflowAdminKey`)
       - `androidKeystoreExportAdminKey` (`get/save/deleteAndroidKeystoreExportAdminKey`)
       - `legacyEdgeAdminKey` (`get/save/deleteEdgeAdminKey`)
     - `validateBeforeSave(...)`-Aufruf auf die drei getrennten Key-Felder umgestellt.
   - `screens/ConnectionsScreen/components/TokensCard.tsx`
     - zeigt drei getrennte Eingabefelder:
       - lokaler Workflow Admin Key
       - lokaler Android Keystore Export Admin Key
       - lokaler Legacy Edge Admin Key (compat)
     - alte Aussage "ein lokaler Edge-Key speist alles" entfernt.

2. **Onscreen-Texte auf scoped Vertrag bereinigt**
   - `screens/ConnectionsScreen/index.tsx`
     - Sync-Summary beschreibt scoped Repo-Secrets klar getrennt (workflow vs keystore)
     - zeigt lokalen SecureStore-Status fuer alle drei lokalen Key-Slots.
   - `screens/GitHubReposScreen/components/SecretsSection.tsx`
     - Runtime-Readiness trennt jetzt vier Reihen:
       - EXPO_TOKEN
       - lokaler Workflow Admin Key
       - lokaler Android Keystore Export Admin Key
       - lokaler Legacy Edge Admin Key (compat)
     - alte Spiegel-/Allzweck-Key-Texte entfernt; Scoped-Nutzung pro Route klar benannt.

3. **Diagnostics auf echte scoped Readiness gezogen**
   - `lib/diagnostics/buildPipelineDiagnostics.ts`
     - neue lokale Checks:
       - `local.workflowAdminKey` (fehlend => `fail`)
       - `local.androidKeystoreExportAdminKey` (fehlend => `warn`)
       - `local.legacyEdgeAdminKey` (gesetzt => `warn`, nur Compat-Hinweis)
     - verhindert false-green durch reinen Legacy-Key.

4. **Fehlermeldungs-/Hint-Texte angepasst**
   - `hooks/actionsLogsTypes.ts`
     - 401-Hinweise unterscheiden jetzt scoped Workflow- vs. scoped Keystore-Vertrag,
       Legacy (`K1W1_EDGE_ADMIN_KEY`) nur noch als Compat-Verweis.

5. **Tests/Contracts nachgezogen**
   - `__tests__/connectionsScreen.validation.test.ts`
     - `validateBeforeSave(...)` auf neue Feldnamen umgestellt und scoped-Key-Validierungen ergaenzt.
   - `__tests__/connectionsScreen.screen.test.tsx`
     - Hook-Mock auf neue Connections-Tokenschnittstelle umgestellt.
   - `__tests__/githubReposScreen.secretsSectionSemantics.test.tsx`
     - SecretsSection-Semantiktests auf scoped Workflow-/Keystore-/Legacy-Readiness und neue Texte angepasst.
   - `__tests__/pipelineDiagnostics.scopedLocalKeys.test.ts`
     - neuer Regressionstest gegen false-green bei nur Legacy-Key vorhanden.

## Dokumentations-/Patchlog-Sync
- `docs/patches/PATCHLOG_ROOT.md` aktualisiert
- `PROJECT_CHECKLOG.md` aktualisiert
- `README.md` aktueller Stand + "Zuletzt abgeschlossen" auf Patch 596
- `docs/01-state-contract.md`, `docs/06-build-readiness.md`, `docs/04-risk-hotspots.md`, `docs/PROJECT_CONTEXT.md` scoped-key-Hinweise klargezogen

## Verifikation (lokal)
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_eas_manual_trigger_controls.sh`
- `bash scripts/check_eas_production_credentials.sh`
- `bash scripts/check_eas_strict_lockfile_policy.sh`
- `bash scripts/check_edge_helper_visibility.sh`
- `bash scripts/check_k1w1_handler_providers.sh`
- `bash scripts/check_supabase_deploy_workflow.sh`
