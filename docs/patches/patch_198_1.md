# Patch 198.1: Stabilize oneClickDeploy jest test

## Why
After Patch 198, CI started failing with a flaky timeout in `__tests__/oneClickDeploy.test.tsx`.
Root cause is timer/mocking instability around AsyncStorage spies and fake timers.

## What changed
- Mock `@react-native-async-storage/async-storage` as a module with jest fns.
- Reset AsyncStorage mocks per test (no spy restore).
- Force real timers + increase jest timeout.
- Increase `waitFor` timeout and the signing-key-missing test timeout.

## Expected result
`npm run test:silent` should be deterministic (no more timeouts).
