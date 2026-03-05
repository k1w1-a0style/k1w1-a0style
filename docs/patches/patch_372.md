# Patch 372 — Expo/Metro: ignore CI-Lite env overlay files

## Problem
`expo start` / Metro tried to treat `.env.ci-lite.local` as a JS module and Babel choked on the first `#` comment:
`SyntaxError: .../.env.ci-lite.local: Unexpected token (1:0)`.

## Fix
We add a Metro resolver `blockList` rule so Metro never attempts to transform these files:
- `.env.ci-lite.local`
- `.env.ci-lite.example`

This keeps CI-Lite shell overlays working **without** breaking the dev client bundler.

## What you need to do
Just apply this patch and restart Metro with cache clear:
- `npx expo start -c`
