# Patch 76 Notes

## Summary
Follow-up hotfix for Patch 75: fix TerminalScreen build break (bad theme/themed hook imports) and align redaction/truncation behavior with tests.

## Changes
- TerminalScreen `LogRow` now uses the existing static `theme` + local `StyleSheet` (removes missing `useThemedStyles` / `createThemeStyles` imports).
- `redactSecrets()` keeps the `Bearer ` prefix and emits a dedicated `<redacted-jwt>` marker for JWT-like tokens.
- `truncateWithMarker()` now guarantees the returned string is **never longer** than `maxChars`.
- Fix truncation test to use a `maxChars` large enough to include the marker.

## Files touched
- `lib/secretRedaction.ts`
- `screens/TerminalScreen/components/LogRow.tsx`
- `__tests__/terminalSecretRedaction.test.ts`
- `docs/reviews/TERMINAL_SCREEN_VERIFICATION.md`
- `docs/TODO.md`
- `PROJECT_CHECKLOG.md`
