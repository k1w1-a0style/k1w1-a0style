# PATCH 42 — Preview Hardening (singleflight, unmount-safety, typing)

Datum: 2026-02-10

## Ziel
Preview-Flows stabilisieren, ohne UI/Architektur umzubauen:
- keine doppelten/parallel laufenden Preview-Creations
- keine State-Updates nach Unmount (weniger Warnungen / weniger Flakiness)
- bessere Typen im Fullscreen-WebView (Requests/Events)

## Änderungen

### `hooks/usePreview.ts`
- Singleflight-Lock über `inFlightRef`: paralleles Triggern (Double-Tap / mehrfaches `createPreview`) wird verhindert.
- Unmount-Safety über `isAliveRef` + `safeSet*` Wrapper: keine State-Updates nach Unmount.
- `reset()` nutzt ebenfalls die Safe-Setter.

### `screens/PreviewFullscreenScreen.tsx`
- Replaced `any` für WebView-Callbacks durch konkrete Typen:
  - `WebViewShouldStartLoadRequest`
  - `WebViewErrorEvent`
  - `WebViewHttpErrorEvent`

### Docs
- `docs/TODO.md`: Preview-Restpunkte ergänzt.
- `PROJECT_CHECKLOG.md`: Patch-Eintrag ergänzt.

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
