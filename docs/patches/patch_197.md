# Patch 197 — Production console guard + logger scaffold

## Why
- The repo contains many `console.log` calls in runtime code. In production, logs can be noisy and may accidentally include secrets.

## What changed
- `polyfills.ts`: in non-dev builds, `console.log/info/debug` are replaced with no-ops. `warn/error` remain.
- `lib/logger.ts`: adds a tiny logger wrapper for future gradual migration.

## Notes
- No behavior change in dev / tests.
- If you *want* logs in production later, remove/adjust the guard in `polyfills.ts`.
