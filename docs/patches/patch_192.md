# Patch 192

Date: 2026-02-19

## Why
- Patch 191 introduced Jest tests for One-Click Deploy.
- Tests failed because mocks used different module ids than the hook's own imports.
- One-Click Deploy previously checked tokens before validating the required Signing Key.

## What

### Safer One-Click Deploy execution order
- **Signing Key check runs first** (hard fail) to avoid unnecessary token/network work.
- Step order in the hook matches the new execution order.

### Fix tests
- Jest mocks now use the **exact module ids** imported inside `useOneClickDeploy`.

## Files
- `screens/EnhancedBuildScreen/hooks/useOneClickDeploy.ts`
- `__tests__/oneClickDeploy.test.tsx`
