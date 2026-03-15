# Patch 449

Datum: 2026-03-15

## Ziel
EnhancedBuildScreen-Restpunkte konservativ schließen: funktionalen OneClickDeploy-Reihenfolgefehler (SHA-Mismatch-Risiko) zuerst beheben, danach nur direkt benachbarte Typing-/Callback-Punkte ohne Broad-Refactor.

## Änderungen
- **`screens/EnhancedBuildScreen/hooks/useOneClickDeploy.ts`**
  - OneClickDeploy führt keinen eigenen Vorab-Push mehr aus; der Schritt `push_files` bleibt als transparenter Skip-Hinweis bestehen.
  - Dadurch bleibt die Reihenfolge SHA-sicher: Build-Readiness + Sync-Entscheidung laufen nur noch in `startBuildJob()`.
  - Redundanter Doppel-Push im OneClick-Flow entfällt.

- **`screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts`**
  - `canStartBuildUi` liest nicht mehr `buildInFlightRef.current` im `useMemo`.
  - Neues State-Flag `buildInFlight` hält UI-Disable konsistent zur Double-Tap-Guard-Ref.
  - `openRunDetails`-Dependencies um unnötige Ref-Einträge bereinigt.

- **WorkflowRun-Typkonsolidierung**
  - Neuer Shared-Typ `shared/types/workflowRun.ts` als gemeinsame Build-/Logs-SoT, inkl. `event`-Feld.
  - `screens/EnhancedBuildScreen/types.ts` nutzt/re-exportiert den Shared-Typ.
  - `hooks/actionsLogsTypes.ts` nutzt/re-exportiert denselben Shared-Typ.
  - `screens/EnhancedBuildScreen/components/LogsAnalysisSection.tsx` ersetzt `workflowRun: any | null` durch `WorkflowRun | null`.

- **Tests**
  - `__tests__/oneClickDeploy.test.tsx` angepasst: Happy-Path prüft jetzt, dass `push_files` im OneClick-Flow bewusst als Skip markiert ist und der Build trotzdem startet.

## Verifikation
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/oneClickDeploy.test.tsx`
- `npm run test:silent`

## Hinweis
Kein Backend-/Architekturumbau: der Fix entkoppelt OneClickDeploy nur vom redundanten Vorab-Push und richtet die flow-nahe Typing-/UI-Konsistenz auf minimalem Scope nach.
