# Patch 373 — Fix Metro config import + ignore CI-lite env overlay

## Problem
After Patch 372, `expo start` crashed with:

- `ERR_PACKAGE_PATH_NOT_EXPORTED: metro-config/src/defaults/exclusionList`

Because newer `metro-config` versions do not export that internal path.

Also, Metro attempted to parse `.env.ci-lite.local` as JavaScript, causing:

- `SyntaxError: .../.env.ci-lite.local: Unexpected token (1:0)`

## Fix
- Stop importing Metro internals (`exclusionList`).
- Use Expo's default Metro config and set `resolver.blockList` with a regex that excludes `.env.ci-lite.local`.
- If an existing block list exists, we merge regex sources.

## Files
- `metro.config.js`
