# Patch 205: remove leftover dead-code shims

## What changed

This patch removes a few legacy files that are no longer referenced anywhere in the codebase (0 imports) after the recent refactors:

- `lib/supabaseTypes.ts`
- `screens/SettingsScreen/utils/keyMasking.ts`
- `shared/types/github.ts`

A small cleanup script is included so the deletions are applied consistently.

## Apply

```bash
chmod +x scripts/patch_205_cleanup.sh || true
./scripts/patch_205_cleanup.sh
```

Then run:

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

## Why this is safe

All three files are orphaned (no imports). Keeping them increases confusion (looks like they are still part of the supported API surface) and creates future drift risk.
