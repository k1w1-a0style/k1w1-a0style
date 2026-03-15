# Patch 454 – OneClickDeploy-Testflake konservativ stabilisiert

## Ziel
Gezielte Stabilisierung des flakigen Tests `__tests__/oneClickDeploy.test.tsx` ohne Broad-Refactor der Produktlogik.

## Echte Flake-Ursache
- Der Test startete den asynchronen Deploy-Flow nur über `fireEvent.press(...)` und verließ sich auf implizites Scheduling.
- Parallel lief im Hook ein initialer AsyncStorage-Effekt (`ONE_CLICK_AUTO_SYNC_SECRETS`), dessen Timing von Mock-Defaults und Test-Interleaving abhing.
- Ohne strikt erzwungenes Cleanup konnten Timer/Effects zwischen Tests eher in Rennen laufen (insb. bei runInBand-Stressläufen).

## Minimaler Fix (nur Test)
- `__tests__/oneClickDeploy.test.tsx`
  - `pressRun(...)`-Helper eingeführt: `fireEvent.press` wird in `act(async () => ...)` ausgeführt, inklusive Microtask-Flush (`await Promise.resolve()`).
  - AsyncStorage-Mocks pro Test auf stabile Defaults gesetzt (`getItem -> null`, `setItem/removeItem -> resolved`).
  - `afterEach`: zusätzlich `cleanup()` + `jest.clearAllTimers()` für saubere Test-Isolation.
  - Alle drei Testfälle nutzen den neuen deterministischen Start-Helper.

## Verifikation (dieser Patch)
- `bash scripts/check_workflow_template_drift.sh` ✅
- `bash scripts/check_managed_workflows.sh` ✅
- `bash scripts/check_workflow_edge_contracts.sh` ✅
- `bash scripts/check_legacy_disabled_edges.sh` ✅
- `bash scripts/check_patch_docs_sync.sh` ✅
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent` ✅
- `npm run test:silent -- --runInBand __tests__/oneClickDeploy.test.tsx` ✅

## Ehrlicher Status
- Der Flake wurde nicht über längere Timeouts kaschiert, sondern über deterministischere Synchronisation und sauberere Test-Isolation reduziert.
- Produktcode (`useOneClickDeploy`) blieb unverändert.
