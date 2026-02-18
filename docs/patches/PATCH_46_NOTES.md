# Patch 46 – PreviewFullscreen Navigation Guards

## Goal
Harden PreviewFullscreen navigation so the preview stays contained and external links are handled safely.

## Changes
- WebView: stricter `originWhitelist` (`http`, `https`, `data`, `about`, `blob`).
- `onShouldStartLoadWithRequest`:
  - In **HTML mode**, any `http(s)` link is opened in the system browser (confirm dialog).
  - In **URL mode**, navigation is allowed only for the **same origin** as the initial preview URL; cross-origin links open externally (confirm dialog).
  - Non-HTTP schemes (`mailto:`, `tel:` etc.) are delegated to the OS (best-effort); otherwise blocked with a friendly alert.

## Files
- `screens/PreviewFullscreenScreen.tsx`
- `docs/TODO.md`
- `docs/patches/PATCH_46_NOTES.md`
- `PROJECT_CHECKLOG.md`

## Verification
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
