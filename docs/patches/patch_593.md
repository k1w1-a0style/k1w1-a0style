# Patch 593: Scoped lokale Admin-Keys als Primärvertrag nachgeschärft

## Ziel
- Lokalen Workflow-Key als klaren Primärvertrag durchziehen.
- Legacy-`edge_admin_key_v1` nur noch kontrolliert kompatibel weiterführen.
- Stille Legacy-Mehrfachspiegelung in Backup-Import entfernen.

## Umsetzung

1. **TokenStore-Vertrag gehärtet (`infra/github/tokenStore.ts`)**
   - `getWorkflowAdminKey()` führt jetzt eine **kontrollierte Einmal-Migration** durch:
     - wenn `workflow_admin_key_v1` fehlt,
     - aber `edge_admin_key_v1` vorhanden ist,
     - wird der Legacy-Wert einmalig in `workflow_admin_key_v1` übernommen.
   - Keine Rückspiegelung (`workflow -> legacy`) eingeführt.
   - Explizite Legacy-Compat-APIs ergänzt:
     - `getLegacyEdgeAdminKey()` / `saveLegacyEdgeAdminKey()` / `deleteLegacyEdgeAdminKey()`.

2. **Workflow-/Build-/Artifact-Caller bleiben Workflow-scoped**
   - `buildStartService`, `buildPollingService`, `useGitHubActionsLogs`, `useCiLiteWorkflow` bleiben auf `getWorkflowAdminKey()`.
   - In `useCiLiteWorkflow` wurden variable Namen auf `workflowAdminKey` harmonisiert (kein irreführendes `edgeAdminKey` mehr in Workflow-Pfaden).

3. **Secret-Sync + AppInfo-Pfade explizit legacy-kompatibel statt implizit**
   - `lib/autoSyncRepoSecrets.ts` liest den Legacy-Key jetzt explizit über `getLegacyEdgeAdminKey()`.
   - `screens/AppInfoScreen/hooks/useAppInfoScreen.ts` nutzt ebenfalls explizite Legacy-APIs (`get/saveLegacyEdgeAdminKey`).

4. **Backup-/Import-Compat ohne stilles Multi-Mirroring (`lib/appInfoScopedBackup.ts`)**
   - Legacy-`tokens.edgeAdminKey` füllt kompatibel nur noch:
     - `tokens.workflowAdminKey`
     - `tokens.legacyEdgeAdminKey`
   - Keine automatische Befüllung mehr von:
     - `tokens.androidKeystoreExportAdminKey`
     - `tokens.signingAdminKey`

## Tests / Regressionen
- `__tests__/tokenStore.edgeAdminKey.test.ts`
  - Scoped-Slots bleiben getrennt.
  - Einmalmigration legacy -> workflow abgesichert.
  - Keine stille Rückspiegelung workflow <-> legacy.
- `__tests__/appInfoSecureBackup.test.ts`
  - Legacy-`edgeAdminKey`-Import bleibt kompatibel,
  - spiegelt aber nicht mehr in Keystore-/Signing-Slots.

## Vertragswirkung
- **Primärvertrag lokal:** Workflow-/Build-/Artifact-Pfade nutzen den dedizierten Workflow-Key.
- **Legacyvertrag:** weiterhin les-/schreibbar, aber klar als Compat-Pfad markiert.
- **Backup-Kompatibilität:** Altbestände mit nur `edgeAdminKey` bleiben kontrolliert importierbar, ohne neue Drift durch Mehrfachspiegelung.
