# Patch 103

## Fix
- **Chat history retention default bug:** If the AsyncStorage key `k1w1_chat_retention_limit` was missing, `Number(null)` evaluated to `0`, which effectively wiped `chatHistory` on load.
- Now, missing/empty values fall back to **DEFAULT_RETENTION = 200**.

## Impact
- Restores ChatScreen history visibility for users who never explicitly set the retention value.
- Fixes `__tests__/chatHistoryMigration.test.ts` (it was failing because retention was implicitly `0`).

## Files
- `lib/chatPrivacySettings.ts`
- `PROJECT_CHECKLOG.md`
- `docs/TODO.md`
- `docs/reviews/CHAT_SCREEN_VERIFICATION.md`
