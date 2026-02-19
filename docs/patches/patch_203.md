# Patch 203: cleanup dead files + finish BuildStatus import migration

## What changed

### ✅ Finish BuildStatus import migration
- `lib/supabaseTypes.ts` now imports `BuildStatus` from `shared/types/build` instead of the legacy `lib/buildStatusMapper` re-export.

### 🧹 Dead-code cleanup (scripted)
Confirmed unused in the repo (0 imports) and safe to delete:
- `contexts/types.ts` (legacy type shim, now fully migrated off)
- `lib/logger.ts` (unused; keeping it around only adds confusion)
- `screens/SettingsScreen/utils/keyMasking.ts` (duplicate masking helper, not referenced)

## How to apply

Unzip, then run:

```bash
chmod +x scripts/patch_203_cleanup.sh || true
./scripts/patch_203_cleanup.sh

npm run typecheck
npm run lint:ci
npm run test:silent
```

## Why this is safe
- Patch 202/202.x moved all imports off `contexts/types.ts`.
- `keyMasking.ts` is dead (the app uses `lib/apiKeyMasking.ts`).
- `logger.ts` is not imported anywhere (and the repo currently tolerates `console.*`).
