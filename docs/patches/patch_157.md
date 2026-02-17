# Patch 157 — PR-6 Stage 3

This patch continues PR-6 by extracting the remaining patcher/defaults logic out of `lib/templateChecklist.ts` into small, focused modules under `lib/diagnostics/templates/*`.

## Changes

- Add `lib/diagnostics/templates/defaults.ts` (minimal boilerplate defaults + minimal `app.json` generator)
- Add `lib/diagnostics/templates/jsonUtils.ts` (shared JSON helpers used by patchers)
- Add `lib/diagnostics/templates/patchers/`:
  - `packageJson.ts`
  - `appJson.ts`
  - `appConfigJs.ts`
  - `easJson.ts`
- Update `lib/templateChecklist.ts` to import these helpers instead of inlining them.

No runtime behavior changes intended.

## Verification

Run:

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

Expected: all green.
