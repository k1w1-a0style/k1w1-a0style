# Patch 457 — Connections Busy-Guard-Fehlersignal entkoppelt + Chat-Guard verifiziert

## Ziel
Den offenen UX-/Flow-Bug im `ConnectionsScreen` schließen: Busy-Kollisionen (`ein anderer Lauf aktiv`) dürfen nicht mehr mit echten Save/Test-Fehlern vermischt werden. Zusätzlich die kritische Pending-Plan-Guard-Logik in `useChatAIFlow` gezielt absichern.

## Umgesetzt
- `screens/ConnectionsScreen/hooks/busyGuard.ts` neu eingeführt:
  - `BusyGuardActiveError` für echte Busy-Kollisionen.
  - `isBusyGuardActiveError` als expliziter Type-Guard.
- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts` minimal umgestellt:
  - `withBusyGuard` wirft bei aktiver Konkurrenz jetzt `BusyGuardActiveError` statt `false` zurückzugeben.
  - `saveAll`, `testGitHub`, `testExpo`, `testSupabase` behandeln Busy-Kollision und echte Fehler getrennt.
  - Hinweis „Ein anderer Save/Test-Lauf ist noch aktiv.“ erscheint nur noch beim Busy-Kollisionsfall.
  - Reale Save-/Test-Fehler bleiben beim jeweiligen Fehl-Alert ohne irreführendes Busy-Nachsignal.
- `hooks/useChatAIFlow.ts` fachlich geprüft: die Pending-Plan-Bedingung (`mode === "advice" && !wantsProceed`) ist im aktuellen Stand sinnvoll und nicht als „useless conditional“ belegbar.

## Tests
- Neue Unit-Regression: `__tests__/busyGuard.test.ts` (Busy-Error/-Guard-Verhalten).
- Invariant aktualisiert: `__tests__/connectionsScreen.flowGuards.invariants.test.ts` prüft Busy-Guard-Nutzung über dedizierte Error-Typen.
- Neue Invariant: `__tests__/useChatAIFlow.pendingPlan.guard.invariants.test.ts` sichert den mode-sensitiven Pending-Plan-Guard.

## Verifikation
- `bash scripts/check_workflow_template_drift.sh` ✅
- `bash scripts/check_managed_workflows.sh` ✅
- `bash scripts/check_workflow_edge_contracts.sh` ✅
- `bash scripts/check_legacy_disabled_edges.sh` ✅
- `bash scripts/check_patch_docs_sync.sh` ✅
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent` ✅
