# Patch 77 Notes

## Summary
TerminalScreen hotfix to restore typecheck/test correctness after Patch 76.

## Changes
- **secretRedaction:** Keep the `Bearer` scheme visible. The generic `Authorization:` redaction no longer clobbers `Authorization: Bearer <redacted>`.
- **LogRow:** Align UI with actual `LogEntry` shape (`timestamp`, `type`, `message`) and fix theme palette usage (`text.primary`/`text.muted`).

## Verification
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
