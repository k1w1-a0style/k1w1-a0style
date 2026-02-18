# Patch 75 Notes

## Summary
TerminalScreen hardening focused on **privacy** (secret redaction) and **stability** (log size caps + safer batching).

## Changes
- Added best-effort secret/token redaction helper (`lib/secretRedaction.ts`).
- Terminal logs are redacted + truncated **before** being stored.
- Copy / Export / Share / AutoFix payloads use redacted + capped logs.
- Cancel `requestAnimationFrame` batching on unmount to avoid state updates after unmount.
- Added tests for redaction and truncation.

## Files touched
- `lib/secretRedaction.ts` (new)
- `contexts/TerminalContext.tsx`
- `screens/TerminalScreen/components/LogRow.tsx`
- `screens/TerminalScreen/hooks/useTerminalScreen.ts`
- `__tests__/terminalSecretRedaction.test.ts` (new)
- `docs/reviews/TERMINAL_SCREEN_VERIFICATION.md` (new)
- `docs/TODO.md`
- `PROJECT_CHECKLOG.md`
