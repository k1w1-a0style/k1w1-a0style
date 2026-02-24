# Patch 272: full fix (Expo connection test + CI Lite/EAS job handling + AIContext stability)

## What changed

### 1) Connections: Expo test now uses Expo GraphQL API
- Replaces the fragile `exp.host` probe (often 404) with the Expo GraphQL endpoint.
- Keeps behavior: if the user is not logged in, we return a clean `AUTH_REQUIRED` result.

### 2) CI Lite / Build start: better error handling when Edge returns non-OK
- `startBuildJob()` now parses error bodies even when HTTP status is non-2xx.
- Ensures the app gets a meaningful error message instead of failing to extract a job id.

### 3) AIContext: provider/mode selection stability improvements
- Ensures a valid default mode is selected when provider changes.
- Prevents invalid mode ids from persisting after switching providers.

## Files
- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`
- `project/services/buildStartService.ts`
- `contexts/AIContext.tsx`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_272.md`

## Notes
Apply this patch on top of your current `work` branch state. It intentionally *supersedes* any earlier “work→34fixed” patch content for `useConnectionsScreen`.
