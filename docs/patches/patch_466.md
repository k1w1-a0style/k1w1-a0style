# Patch 466 - CodeScreen/File-Editor/File-Actions Restpunkte konservativ geschlossen

## Ziel
Die bestätigten Restprobleme im CodeScreen-Block minimal und robust schließen: Editor-WebView-Recovery, Folder-Delete-Batching, Delete-Guard-Härtung, flow-nahe Cleanup-Reste und gezielte Regressionstests.

## Änderungen
- **WebCodeEditor Crash-Recovery verdrahtet**: `onContentProcessDidTerminate` + `onRenderProcessGone` sind jetzt am Editor-WebView angebunden und nutzen den bestehenden shared Recovery-Mechanismus aus dem Preview-Bereich (`useWebViewCrashRecovery`) statt neuer Architektur.
- **Folder-Delete gebatcht**: `useFileActions` nutzt bei Folder-Delete jetzt `deleteFiles(paths)` (Fallback bleibt kompatibel), statt Datei-für-Datei sequentiell zu löschen.
- **Minimaler Context-Nachzug**: `ProjectContext`/`projectTypes` um optionale `deleteFiles(paths)`-API erweitert; Implementierung löscht über ein einziges `updateProject` mit `Set`-Filter.
- **Delete-Handler-Schutz gehärtet**: `handleDeleteFile` hat einen expliziten Guard für fehlendes `actionTargetFile` mit klarer Fehlermeldung.
- **Flow-nahe Cleanup-Reste**: tote Imports im CodeScreen-FileActions-Hook entfernt.

## Tests
- Neu: `__tests__/webCodeEditor.recovery.test.tsx`
  - prüft Verdrahtung der Crash-Handler und dass der Recovery-Pfad weiterhin mit Handlern re-rendered.
- Neu: `__tests__/useFileActions.regression.test.tsx`
  - prüft Folder-Batch-Delete über `deleteFiles(...)`.
  - prüft expliziten Guard bei `handleDeleteFile()` ohne Target.

## Verifikation (ausgeführt)
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
