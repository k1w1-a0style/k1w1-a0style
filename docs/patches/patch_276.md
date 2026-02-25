# Patch 276: UI unify + Expo persistence + EAS status validation

## What changed

- **Chat + Header Buttons:** Unified to a filled, consistent look (primary background, consistent border weight, readable icon color).
- **Scroll-to-bottom button:** Now filled primary (no more “transparent / mismatched” look).
- **Expo Test persistence:** Successful Expo token validation now **auto-saves the Expo token**, so the status can remain green after restart even if the user only pressed “Test”.
- **EAS Project ID status:** Added a more robust validation strategy:
  - best-effort REST check,
  - **GraphQL fallback** for UUID-style EAS Project IDs.
  - Auto-check once after hydration when token + project id are present.

## Files touched

- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`
- `styles/chatComposerStyles.ts`
- `styles/chatScreenStyles.ts`
- `components/chat/ChatScrollToBottomButton.tsx`
- `components/ChatHeaderActions.tsx`
- `docs/patches/PATCHLOG_ROOT.md`

