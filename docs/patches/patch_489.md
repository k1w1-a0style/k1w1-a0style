# Patch 489 — Preview-/Server-Contract ehrlich gehärtet

## Was wurde geändert?

- `hooks/previewHelpers.ts`: kleiner gemeinsamer Preview-Contract ergänzt. Er klassifiziert Remote-URLs jetzt als `trusted` / `missing` / `invalid` / `insecure`, modelliert ehrliche UI-Zustände (`remote_ready`, `fallback_active`, `unavailable`, `loading`, `failed`) und hält das minimale Mixed-Content-Policy-Setting zentral.
- `hooks/usePreview.ts`: Remote-Preview-Fehler werden jetzt als kurze, nutzerlesbare `remoteFailure`-Information konservativ mitgeführt, statt im lokalen HTML-Fallback implizit „wegzuerfolgreichen“. Damit bleibt der Fallback benutzbar, ohne Server-Gesundheit vorzutäuschen.
- `screens/PreviewScreen/hooks/usePreviewScreen.ts` + `screens/PreviewScreen/components/PreviewStatusBar.tsx` + `screens/PreviewScreen/PreviewScreen.tsx`: PreviewScreen verwendet jetzt denselben gemeinsamen Status-Contract für Toolbar/Statusleiste/Notices. Fallback, unavailable, abgelaufene/unsichere Remote-URLs und echte Fehler werden sichtbar getrennt; Browser-/QR-Aktionen erscheinen nur noch für verlässlich vertrauenswürdige Remote-Preview-Links.
- `screens/PreviewScreen/components/DeviceFrame.tsx` + `screens/PreviewFullscreenScreen/PreviewFullscreenScreen.tsx` + `screens/PreviewFullscreenScreen/hooks/usePreviewFullscreen.ts`: beide Preview-WebViews nutzen jetzt ein engeres `mixedContentMode="never"`; Fullscreen blockiert unsichere/ungültige Remote-URLs ebenfalls ehrlich statt sie wie normale Ready-Previews zu laden.
- Tests ergänzt/angepasst: `__tests__/previewHelpers.test.ts`, `__tests__/previewStatusBar.statusText.test.ts`, `__tests__/usePreview.serverContract.test.tsx`, `__tests__/previewWebViewContract.test.tsx`.

## Kritische Einordnung

- Kein Umbau der Preview-Architektur: nur ein kleiner gemeinsamer Status-/Security-Helper plus enge Anpassungen an bestehenden Preview-Hooks und -Komponenten.
- Lokaler HTML-Fallback bleibt absichtlich erhalten, wird aber nicht mehr mit einer verifizierten Remote-Preview gleichgesetzt.
- Bereits vorhandene Preview-/Crash-Recovery-/Hot-Reload-Pfade bleiben bestehen; gehärtet wurden nur URL-/Status-/WebView-Guards und die sichtbare Semantik.

## Verifikation

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
