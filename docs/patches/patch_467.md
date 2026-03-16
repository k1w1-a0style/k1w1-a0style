# Patch 467 - Flow-nahe Maintenance-/Typing-Restpunkte konservativ nachgezogen

## Ziel
Den verbleibenden allgemeinen Wartungs-/Typing-Block ohne Broad-Refactor entschärfen: kleine flow-nahe `any`-Hotspots reduzieren, einen toten Import entfernen und bestehende Error-/Migration-Pfade enger typisieren.

## Änderungen
- **`useChatAIFlow` (Validator-Bridge):** unnötiges `any` im `normalized.map(...)` entfernt; die Dateiliste bleibt über die bereits normalisierte Struktur typisiert.
- **`useGitHubActionsLogs` (Error-Path):** toten Import (`redactSecrets`, `truncateWithMarker`) entfernt; `catch (err: any)` auf `unknown` umgestellt und Fehlertext robust über `instanceof Error` ausgelesen.
- **`actionsLogsTypes` (Edge-Fehlerparse):** internes `bodyJson` in `describeEdgeFailure(...)` von `any` auf lokales, enges Payload-Interface umgestellt.
- **`persistenceHelpers` (Storage-Migration):** `ensureChatHistoryHasIds(...)` nimmt jetzt `unknown[]` statt `any[]`; zusätzlicher lokaler Type-Guard (`isLegacyChatMessageLike`) hält den Migrationspfad defensiv und klar.

## Nicht Bestandteil dieses Schritts (bewusst offen)
- Keine repo-weite `any`-Eliminierung in Infra-/Template-/Test-Dateien.
- Keine Architekturänderung in GitHub-/CI-Lite-/Repos-Screens.
- Keine kosmetische Massenbereinigung ohne direkten Flow-Nutzen.

## Verifikation (ausgeführt)
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
