# Patch 59 — PreviewScreens hardening (security + stability + tests)

Datum: 2026-02-11

## Änderungen
- Security: Preview WebView Navigation Guard fail-closed + Scheme-Allowlist (block dangerous schemes).
- Security/Hardening: PreviewFullscreen `originWhitelist` mode-spezifisch und deutlich enger.
- Stability/UX: One-shot Auto-Recovery bei WebView Prozess-Abbruch (mit Loop-Schutz).
- Maintainability: `useCallback` deps bereinigt (kein unnötiger Re-create).
- Tests: `previewNavigationGuards` um kritische Negativfälle erweitert.

## Betroffene Dateien
- `utils/previewNavigation.ts`
- `screens/PreviewFullscreenScreen.tsx`
- `__tests__/previewNavigationGuards.test.ts`
- `docs/reviews/PREVIEW_SCREENS_VERIFICATION.md`
- `docs/TODO.md`

