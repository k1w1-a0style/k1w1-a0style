# Patch 73 Notes

## Goal
Hotfix for `CredentialsWizardScreen` after Patch 72: resolve remaining TypeScript errors in tests.

## What changed
- **Type fix**: extend `WizardHttpDebug` to allow `ms?: number` (request duration) because the unit test debug objects include it.

## Behavior / UI impact
No UI/layout changes. No runtime behavior changes — TypeScript contract only.
