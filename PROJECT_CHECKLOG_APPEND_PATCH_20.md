## Patch 20 — Fix expo.extra.eas.projectId locally + in CI

**Problem:** `npx expo config --json` returned `expo.extra.eas.projectId = undefined` even though `eas-project.json` existed.

**Root cause:** `app.config.js` was not reliably setting `extra.eas.projectId` (CWD differences / merge logic).

**Fix:** `app.config.js` now:
- reads `./eas-project.json` using `__dirname` (repo root)
- merges `config.extra` safely
- falls back to `EAS_PROJECT_ID` / `EXPO_PUBLIC_EAS_PROJECT_ID` in CI

**Verification:**
- `npx expo config --json | ...` prints a UUID
- GitHub CI step “Expo config smoke test (projectId present)” passes
