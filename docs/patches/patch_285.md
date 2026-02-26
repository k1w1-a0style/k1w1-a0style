# Patch 285

## Fixes
- Fix broken import section in `WorkflowRunDetailModal.tsx` (dangling `import type {` caused TS/ESLint parser failure).
- Fix `MessageItem.styles.ts` invalid default export (`export default MessageItem;`) which crashed Jest (`MessageItem is not defined`).

## Verification
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
