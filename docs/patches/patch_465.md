# Patch 465 - SettingsScreen/AIContext Restpunkte (Retention) final konservativ geschlossen

## Ziel
Die verbliebenen, bestätigten Restpunkte aus SettingsScreen + AIContext/ProjectContext minimal und regressionssicher schließen, ohne Broad-Refactor.

## Änderungen
- **Retention-Input-Parsing gehärtet**: Leere Eingaben (`""`, nur Whitespace) werden im Save-Pfad jetzt explizit als ungültig behandelt statt implizit über `Number("") === 0` gespeichert.
- **Hydration-Race entschärft**: Ein verspäteter `loadChatHistorySettings()`-Initial-Load überschreibt keinen Runtime-Retention-Wert mehr, der bereits aktiv gesetzt wurde.
- **Kleiner Cleanup**: `handleMoveKeyToFront`-Fallback im Settings-Hook leicht vereinfacht (gleiches Verhalten, weniger doppelter Try/Fallback-Code).

## Tests
- Neu: `__tests__/settingsScreen.retentionInput.test.ts`
- Neu: `__tests__/projectContext.retentionHydrationGuard.test.ts`
- Verifiziert mit Full-Checks: workflow scripts, typecheck, lint, kompletter testlauf.

## Verifikation (ausgeführt)
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
