# Patch 204: Fix over-aggressive Patch 203 cleanup (restore required files)

## Why
Patch 203’s cleanup script removed files that are **still imported by the app**:

- `contexts/types.ts` is still imported by `contexts/ProjectContext.tsx`.
- `lib/logger.ts` is still imported by `screens/PreviewFullscreenScreen/hooks/usePreviewFullscreen.ts`.

Deleting them causes:
- TypeScript `noImplicitAny` cascades (because types disappear)
- Jest runtime failure: `Cannot find module '../../../lib/logger'`

## What changed
- Restore (or keep) `contexts/types.ts`
- Restore (or keep) `lib/logger.ts`
- Replace `scripts/patch_203_cleanup.sh` with a **safe mode** version that only removes the confirmed-unused `screens/SettingsScreen/utils/keyMasking.ts`.

## How to apply
```bash
unzip -o k1w1-a0style_patch_204.zip -d .
rm -f k1w1-a0style_patch_204.zip

chmod +x scripts/patch_203_cleanup.sh || true
./scripts/patch_203_cleanup.sh

npm run typecheck
npm run lint:ci
npm run test:silent
```
