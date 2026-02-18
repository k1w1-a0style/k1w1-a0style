# PATCH 44 — CodeScreen refactor + validation deferral + bridge hardening

## Summary
This patch implements the three deferred CodeScreen tasks:

1) Split the former "god hook" `useCodeScreen` into focused sub-hooks (maintainability).
2) Defer validation work so UI interactions get priority (`InteractionManager.runAfterInteractions`).
3) Harden WebView↔RN bridge parsing + add unit tests.

## Changes

### 1) `useCodeScreen` split
- `useCodeScreen` becomes a thin orchestrator.
- New sub-hooks:
  - `useFileExplorer` (file tree + selection + export)
  - `useFileEditor` (selected file, content, dirty tracking, save, validation)
  - `useFileActions` (CRUD, press/long-press logic, clipboard)
- Public return interface remains the same → no changes required in `screens/CodeScreen/index.tsx`.

### 2) Validation deferral
- Validation is still debounced, but the CPU-heavy work is now scheduled via `InteractionManager.runAfterInteractions`.
- For large files, quality checks are skipped; for huge files, validation is skipped entirely (avoid stalls).

### 3) Bridge hardening + tests
- `WebCodeEditor` now parses inbound messages using:
  - strict type-guard (`isInboundMsg`)
  - size limit (`MAX_BRIDGE_PAYLOAD`)
  - sanitized return objects (drops unknown fields)
- Added `__tests__/bridgeValidation.test.ts` covering invalid JSON, wrong types, oversize payloads, and extra fields.

## Files
- `screens/CodeScreen/hooks/types.ts`
- `screens/CodeScreen/hooks/useCodeScreen.ts`
- `screens/CodeScreen/hooks/useFileEditor.ts`
- `screens/CodeScreen/hooks/useFileExplorer.ts`
- `screens/CodeScreen/hooks/useFileActions.ts`
- `screens/CodeScreen/components/WebCodeEditor.tsx`
- `__tests__/bridgeValidation.test.ts`
- `docs/TODO.md`
- `docs/patches/PATCH_44_NOTES.md`
- `PROJECT_CHECKLOG.md`

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
