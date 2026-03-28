# Patch 597 — Credentials Wizard + Keystore Status/Generate auf scoped JWT+Key-Vertrag

## Kontext

Nach Patch 588 waren die Edge-Routen `android-keystore-status` und `android-keystore-generate` serverseitig bereits auf scoped Keystore-Secret + JWT-RBAC gehaertet.
Im Credentials Wizard lief der Caller-Vertrag aber noch uneinheitlich: lokaler Key-Pfad war legacy-lastig und die Keystore-Requests gingen nicht konsequent mit kombiniertem JWT+Scoped-Key-Header raus.

## Umsetzung

1. **Wizard-Key-SoT auf dedizierten Keystore-Key gezogen**
   - `useCredentialsWizardScreen` liest jetzt primär `getAndroidKeystoreExportAdminKey()`.
   - Legacy `getEdgeAdminKey()` bleibt nur als kontrollierter Compat-Read-Fallback.
   - Speichern/Löschen erfolgt über `saveAndroidKeystoreExportAdminKey()`.

2. **Keystore-Request-Vertrag finalisiert**
   - `invokeEdgeJson(...)` nimmt jetzt zusätzlich den Supabase-User-JWT an.
   - Requests an `android-keystore-status` und `android-keystore-generate` senden:
     - `Authorization: Bearer <Supabase user JWT>`
     - `x-k1w1-admin-key: <lokaler androidKeystoreExportAdminKey>`

3. **Wizard UX-/Diagnose-Texte klarer scoped**
   - Keystore-spezifische Hinweise sprechen explizit vom lokalen **Android Keystore Export Admin Key** statt generischem Edge-Admin-Key.

4. **Contract-/Drift-Checks ergänzt**
   - `scripts/check_workflow_edge_contracts.sh` prueft jetzt zusätzlich:
     - Wizard-Header-Kombi (`Authorization` + `x-k1w1-admin-key`)
     - Wizard-Nutzung der dedizierten Keystore-Key-APIs

## Betroffene Dateien (Kern)

- `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts`
- `screens/CredentialsWizardScreen/hooks/credentialHelpers.ts`
- `screens/CredentialsWizardScreen/utils/localAdminKey.ts`
- `screens/CredentialsWizardScreen/components/AdminKeySection.tsx`
- `screens/CredentialsWizardScreen/statusContract.ts`
- `scripts/check_workflow_edge_contracts.sh`
- `__tests__/credentialsWizardInvokeEdgeJson.test.ts`
- `__tests__/credentialsWizard.trustSemantics.test.tsx`
- `__tests__/localAdminKey.test.ts`

## Validierung (lokal)

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_edge_helper_visibility.sh`
- `bash scripts/check_patch_docs_sync.sh`
