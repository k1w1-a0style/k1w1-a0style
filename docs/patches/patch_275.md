# Patch 275: Fix ChatComposer canSend regression

## Problem
`components/chat/ChatComposer.tsx` referenced `canSend` but never defined it, causing `tsc` to fail on commit.

## Fix
- Add `hasMessage` + `canSend` derived state.
- Disable send button when nothing to send (no text + no attachment) or while loading.
- Allow submit via keyboard when an attachment is selected.

## Files
- `components/chat/ChatComposer.tsx`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_275.md`
