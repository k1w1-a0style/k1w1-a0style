# Patch 451 — PreviewScreen/PreviewFullscreen Restfix (Fingerprint + Crash-Recovery + Expiry)

## Ziel
Konservative Restbehebung im Preview-Block ohne Architekturumbau:
- zuverlässigeres Hot-Reload bei echten Dateiänderungen
- Crash-Recovery auch im normalen PreviewScreen
- abgelaufene Supabase-Preview-URLs nicht mehr blind laden
- flow-nahe Helper-/Typing-/Dependency-Reste schließen

## Änderungen

1. **Fingerprint auf Content-Basis gehärtet**
   - `usePreview` berechnet `filesFingerprint` jetzt über Pfad + **Inhalts-Hash je Datei** (statt nur Längen-/Key-Form).
   - Same-Length-Edits triggern damit zuverlässig den Hot-Reload.

2. **Crash-Recovery im normalen PreviewScreen verdrahtet**
   - `useWebViewCrashRecovery` wird jetzt auch in `usePreviewScreen` genutzt.
   - `DeviceFrame` reicht `onContentProcessDidTerminate` / `onRenderProcessGone` bis zur WebView durch.
   - Recovery-Status wird bei Reload/Create/erfolgreichem Load sauber zurückgesetzt.

3. **Expiry-Verhalten im PreviewScreen gehärtet**
   - Abgelaufene Supabase-URLs werden im PreviewScreen nicht mehr als aktive WebView-Quelle verwendet.
   - Statt blindem Laden greift der bestehende Create-/Fallback-Flow.
   - Expiry-/Fallback-Texte sind expliziter (inkl. Hinweis auf transienten lokalen HTML-Fallback).

4. **Helper-/Typing-/Dependency-Dedup im Preview-Block**
   - Zentrale Preview-Helfer (`promiseWithTimeout`, File-Filter, Hashing, `PreviewState`, `PreviewResult`) in `hooks/previewHelpers.ts` konsolidiert.
   - `usePreview` nutzt diese SoT-Helper und hängt `previewFiles` nur noch an `projectData?.files`.
   - Tote/duplizierte Preview-Helper-Definitionen in `usePreview.ts` entfernt.

## Tests
- `__tests__/usePreview.fingerprint.test.tsx` neu (same-length content change verändert Fingerprint)
- `__tests__/previewHelpers.test.ts` erweitert (`isPreviewExpired`, aktualisierte Expiry-/Fallback-Texte)
- bestehende Preview-Tests weiter grün (`usePreview.rehydration`, Preview-Navigation, Statusbar)

## Verifikation
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
