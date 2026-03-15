# Patch 455 — ConnectionsScreen: Secret-Storage + Busy/Flow Guards (konservativ)

## Ziel
Bestätigte Restpunkte im ConnectionsScreen ohne Broad-Refactor schließen: sichere Supabase-ANON-Persistenz, parallele Save/Test-Runs blockieren, test-/flow-nahe Seiteneffekte ehrlicher machen.

## Umgesetzt
- `lib/supabaseAnonKeyStorage.ts` neu:
  - Supabase ANON Key wird in `expo-secure-store` (`supabase_anon_key_v1`) gespeichert.
  - Legacy-Read aus `AsyncStorage(STORAGE_KEYS.SUPABASE_KEY)` wird beim Lesen einmalig migriert und danach entfernt.
- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`:
  - Busy-Guard (`withBusyGuard` + `busyRef`) für `saveAll`, `testGitHub`, `testExpo`, `testSupabase`.
  - Hydration-Guard (`hydrated`) vor aktiven Save/Test-/Link-Aktionen.
  - `testExpo` persistiert **nicht** mehr den Token als Side-Effect.
  - Supabase ANON Save/Delete nutzt jetzt SecureStore-Helper statt AsyncStorage-Key.
  - Connection-Light-Persistenz bei mehreren Keys über `multiSet`/`multiRemove` gebündelt (mit Fallback auf einzelne Writes).
  - `onLinkExisting` setzt EAS-Lampe nach Workflow-Start nicht mehr optimistisch auf grün, sondern neutral/false bis echter EAS-Test erfolgt.
  - Obsoleter `SUPABASE_SERVICE_ROLE_KEY`-Ghost-Cleanup aus diesem Hook entfernt.
- `screens/ConnectionsScreen/index.tsx`:
  - UI-Actions bleiben bis Hydration abgeschlossen ist deaktiviert (`busy || !hydrated`).
- `lib/supabase.ts` + `screens/AppInfoScreen/hooks/useAppInfoScreen.ts`:
  - Lesen/Backup-Import des Supabase-ANON-Keys auf den neuen SecureStore-Helper umgestellt, damit angrenzende Flows konsistent bleiben.

## Tests
- Neu: `lib/__tests__/supabaseAnonKeyStorage.test.ts` (SecureStore-Persistenz + Legacy-Migration + Delete).
- Neu: `__tests__/connectionsScreen.flowGuards.invariants.test.ts` (Busy-Guard vorhanden, kein `saveExpoToken`-Side-Effect in `testExpo`, kein optimistisches `setEasOk(true)` beim Link-Start).

## Verifikation
- `bash scripts/check_workflow_template_drift.sh` ✅
- `bash scripts/check_managed_workflows.sh` ✅
- `bash scripts/check_workflow_edge_contracts.sh` ✅
- `bash scripts/check_legacy_disabled_edges.sh` ✅
- `bash scripts/check_patch_docs_sync.sh` ✅
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent` ✅

## Ehrlicher Reststatus
- Kein Architekturumbau des gesamten Connections-Systems.
- `testEas` selbst bleibt ein eigener EAS-Test-Flow (mit separatem `isTestingEas`), wird aber über `busyRef` gegen parallele Save/Test-Runs abgesichert.
