# Patch 290

## Summary
- Add regression test for apply/merge summary formatting so file paths are always shown.
- Extract confirmation text builder into a pure helper to keep `useChatAIFlow` stable and testable.

## Files
- `hooks/chatChangeSummary.ts` (new)
- `__tests__/chatChangeSummary.test.ts` (new)
- `hooks/useChatAIFlow.ts` (updated)
