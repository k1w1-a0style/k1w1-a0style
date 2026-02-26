# Patch 279: EAS test + CI Lite dispatch errors + header button polish

## What changed

- **EAS Test** now validates the UUID project id via the authenticated Expo API (`api.expo.dev`) using the saved **Expo Token**.
  - This avoids the previous `exp.host` endpoint that expects `@owner/slug` and returns **400** for UUIDs.
- **GitHub workflow dispatch** edge function now **preserves upstream status codes** instead of always returning **502**.
  - 404 is reported as *workflow not found* with a clear hint.
- **Header buttons** (main header + chat header actions + CI Lite icon) switched to a **filled primary style** to match the rest of the UI.
- **CI Lite progress bar** track is forced to `width: 100%` to prevent overflow on smaller screens.

## Files touched

- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`
- `supabase/functions/github-workflow-dispatch/index.ts`
- `components/CustomHeader.tsx`
- `components/ChatHeaderActions.tsx`
- `components/CiLiteHeaderButton.tsx`
- `docs/patches/PATCHLOG_ROOT.md`
