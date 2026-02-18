# PATCH 53 NOTES

## Summary
PreviewFullscreen: WebView-Prozess-Abbrüche werden jetzt sauber abgefangen (Android Render Process Gone / iOS Content Process Termination) und der User bekommt einen klaren Reload-Pfad.

## Changes
- Added handlers for:
  - `onRenderProcessGone` (Android) → setzt Error-State + verhindert Crash (return true)
  - `onContentProcessDidTerminate` (iOS) → setzt Error-State
- Reload/LoadStart resetten den Termination-Guard, damit erneutes Laden sauber funktioniert.

## Files
- `screens/PreviewFullscreenScreen.tsx`
- `docs/TODO.md`
- `docs/patches/PATCH_53_NOTES.md`
- `PROJECT_CHECKLOG.md`

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
