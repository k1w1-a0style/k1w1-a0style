# Patch 200.1: Preview refactor hotfix + cleanup script

## Fix
- Fix TypeScript type mismatch in `useWebViewCrashRecovery`: accept `RefObject<WebView | null>`.

## Cleanup
- Adds `scripts/patch_200_cleanup.sh` to remove confirmed dead files:
  - `styles/previewScreenStyles.ts`
  - `lib/previewSettings.ts`

## Apply
```bash
chmod +x scripts/patch_200_cleanup.sh || true
./scripts/patch_200_cleanup.sh
```
