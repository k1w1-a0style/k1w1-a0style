# Patch 287

## Fixes
- Fix TS parser errors introduced in Patch 286.
  - `components/MessageItem.tsx`: remove stray literal `\n` before `export default`.
  - `contexts/terminalContextHelpers.ts`: fix invalid `export type` syntax and make helper file minimal + valid.
  - `hooks/usePreview.ts`: restore the correct implementation (Patch 286 accidentally injected invalid `)) as any` tokens).
- Restore `contexts/TerminalContext.tsx` to the stable implementation (removes dependency on the helper file).

## Notes
This patch is intentionally small and surgical: it only restores valid TypeScript syntax and a known-good preview hook.
