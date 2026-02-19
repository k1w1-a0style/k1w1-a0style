# Patch 199 — Stabilize Jest timeouts

## Why
Some React Native integration-style tests can be slow or occasionally hang long enough to trip Jest's default 5s timeout on certain environments.
This patch increases the global Jest test timeout to reduce flaky failures.

## Changes
- `jest.setup.js`: `jest.setTimeout(20000);` (global)

## Notes
- This does **not** change runtime/app behavior.
- If a test truly hangs, it will still fail — just after a longer window.
