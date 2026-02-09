## Patch 21
- **Fix (CI/local):** Make `expo.extra.eas.projectId` deterministic by:
  - Reading `eas-project.json` via absolute path (`__dirname`)
  - Supporting env overrides (`EAS_PROJECT_ID` / `EXPO_PUBLIC_EAS_PROJECT_ID`)
  - Throwing a clear error when missing (instead of silently returning undefined)
- **CI improvement:** Export `EAS_PROJECT_ID` from `eas-project.json` before running `expo config` to avoid CWD quirks.
- **New helper:** `scripts/getEasProjectId.js` for debugging/CI.
