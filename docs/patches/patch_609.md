# Patch 609

## Ziel
Finalen Cleanup-/Sunset-Schritt fuer den Legacy Edge Admin Key Compat-Vertrag umsetzen: produktive Keystore-Runtimepfade auf scoped-only ziehen, verbleibende Legacy-Nutzung explizit auf Compat-/Migrationsgrenzen begrenzen, und diese Grenzen per Tests/Checks dokumentieren.

## Audit (Klassifikation)

### A) Produktiver Runtime-/Primaerfluss
- `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts`
- `screens/EnhancedBuildScreen/hooks/signingKeyGate.ts`
- `hooks/usePreview.ts`
- `lib/orchestrator/k1w1Edge.ts`
- `screens/GitHubReposScreen/components/SecretsSection.tsx` (Runtime-Readiness-UI)

### B) Uebergang-/Migration
- `infra/github/tokenStore.ts` (Legacy-Slot + kontrollierte Migration `edge_admin_key_v1 -> workflow_admin_key_v1`)
- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts` (manuelle Pflege/Sunset-Eingabe)

### C) Backup/Restore/AppInfo/Export-Compat
- `lib/appInfoScopedBackup.ts`
- `screens/AppInfoScreen/hooks/useAppInfoScreen.ts`
- `lib/autoSyncRepoSecrets.ts` (Legacy-Secret optional)

### D) Test-/Invariant-Absicherung
- `__tests__/tokenStore.edgeAdminKey.test.ts`
- `__tests__/usePreview.serverContract.test.tsx`
- `__tests__/signingKeyGate.test.ts`
- `__tests__/patch609.legacyEdgeAdminSunsetBoundaries.invariants.test.ts` (neu)

### E) Doku/UX/Hint
- `components/CiLiteHeaderButton/components/CiLiteModal.tsx`
- `lib/diagnostics/buildPipelineDiagnostics.ts`
- README/Checklog/Patchlog/State-/Readiness-/Risk-Doku

## Umsetzung
1. **Runtime Scoped-only fuer Keystore:**
   - Wizard liest nur noch `getAndroidKeystoreExportAdminKey()` (kein `getLegacyEdgeAdminKey()`-Fallback).
   - Signing Gate nutzt denselben scoped Keystore-Key statt Legacy-Read.
2. **Legacy nicht mehr als stiller Runtime-Blocker in Secrets-UI:**
   - Fehlender Legacy-Key erzeugt in SecretsSection keine "Repo Secret ≠ Lokaler App-Wert"-Blocker-Summary mehr.
3. **Verbleibende Legacy-Reste explizit als Sunset markiert:**
   - Preview/Orchestrator/Diagnostics/CI-Lite-Hints klar auf Compat-/Sunset-Scope gezogen.
4. **Contracts abgesichert:**
   - Neue Invariant verhindert neue `getLegacyEdgeAdminKey()`-Nutzung ausserhalb einer expliziten Allowlist.
   - `scripts/check_workflow_edge_contracts.sh` erzwingt scoped-only Wizard/Signing und aktualisierte CI-Lite-Modal-Hinweise.

## Verbleibende bewusste Compat-Stellen (nach Patch 609)
- `hooks/usePreview.ts`: `save_preview`-Route ist weiterhin Legacy-admin-secret-basiert.
- `lib/orchestrator/k1w1Edge.ts`: `k1w1-handler` bleibt Legacy-admin-secret-basiert.
- `screens/AppInfoScreen/hooks/useAppInfoScreen.ts`, `lib/appInfoScopedBackup.ts`: Backup/Restore-/Altimport-Compat.
- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`: explizite Legacy-Verwaltung fuer Altmigration.
- `lib/autoSyncRepoSecrets.ts`: optionales Legacy-Secret-Sync fuer Uebergangsfaelle.

## Exit-Kriterien fuer komplette Legacy-Entfernung
1. `save_preview` und `k1w1-handler` besitzen eigene scoped Admin-Vertraege (oder sind abgeloest).
2. Keine aktiven Alt-Backups/Restore-Pakete mehr mit `edgeAdminKey`/`legacyEdgeAdminKey`-Abhaengigkeit.
3. `autoSyncRepoSecrets` braucht `K1W1_EDGE_ADMIN_KEY` nicht mehr als optionalen Export.
4. Allowlist-Invariant ist leerbar (kein produktiver Aufrufer mehr).
