# PATCH 43 — PreviewFullscreen typing fix (react-native-webview compat)

Datum: 2026-02-10

## Problem
Im Repo ist `react-native-webview@13.15.0` im Einsatz. Diese Version exportiert die Event-Typen
`WebViewErrorEvent`, `WebViewHttpErrorEvent` und `WebViewShouldStartLoadRequest` nicht als Named Exports.
Patch 42 hat diese Named Imports genutzt, wodurch `tsc` fehlschlägt.

## Ziel
- `tsc` wieder grün
- Typing behalten (kein `any`)

## Änderungen

### `screens/PreviewFullscreenScreen.tsx`
- Named Imports entfernt.
- Lokale Minimaltypen für WebView-Request und Error-Events eingeführt (nur Felder, die genutzt werden: `url`, `description`, `statusCode`).
- Handler-Signatures angepasst.

### Docs
- `docs/TODO.md`: Preview-Hardening als Done markiert.
- `PROJECT_CHECKLOG.md`: Patch 43 Eintrag ergänzt.

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
