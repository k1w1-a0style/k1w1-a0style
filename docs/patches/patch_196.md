# Patch 196 — Safe cleanup (dead files + shims)

## Goal
Reduce clutter and avoid confusing duplicate entry points **without changing runtime behavior**.

## Changes
- Added `scripts/patch_196_cleanup.sh` to remove confirmed-unused files:
  - `lib/previewBuild.ts` (no imports; only referenced in docs)
  - `screens/CodeScreen/useCodeScreen.ts` (unused shim; CodeScreen imports `./hooks/useCodeScreen` directly)
  - `screens/TerminalScreen/TerminalScreen.tsx` (unused barrel re-export)

## How to apply
1) Unzip patch into repo root.
2) Run cleanup script.
3) Run the standard 3 CI checks.

```bash
chmod +x scripts/patch_196_cleanup.sh || true
./scripts/patch_196_cleanup.sh

npm run typecheck
npm run lint:ci
npm run test:silent
```

## Notes
- The cleanup script is idempotent (safe to run multiple times).
- Deletions are done via script because ZIP extraction can't remove files.
