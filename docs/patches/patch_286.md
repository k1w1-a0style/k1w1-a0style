# Patch 286: TS typecheck recovery + missing exports/imports

## Why
Patch 283 introduced truncated / refactored files. Patch 284/285 fixed syntax/runtime, but TypeScript `tsc --noEmit` still failed due to missing imports/exports and a couple of refactor gaps.

## Fixes
- Fix `getNeonGlow` missing import in `FileItem.styles.ts` (also fixes App.test runtime crash).
- Add missing `styles` in `CustomDrawer/PulseDot.tsx`.
- Make CiLiteModal `addChatMessage` accept sync or async handler.
- Restore missing exports:
  - `ApplyFilesResult` in `lib/fileWriter.ts`
  - `SandpackOptions` in `lib/sandpackBuilder.ts`
  - `useAI` hook in `contexts/AIContext/index.tsx`
  - default export in `components/MessageItem.tsx`
- TerminalContext: export needed types + safe log id helpers; remove direct `logCounter` references.
- Fix common refactor mistake: `export type {X}` without `import type {X}` in several hooks.
- Diagnostic + GitHub helpers: remove duplicate imports, export `CORE_TEMPLATE_FILES`, remove `GitHubBranch` type conflict.
- Add explicit types in a few tests to satisfy `noImplicitAny`.

## Validation
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
