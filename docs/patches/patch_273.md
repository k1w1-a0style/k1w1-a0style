# Patch 273: Debug Overlay (Connections + Build/Workflow)

## Why
When "Expo Test" returns 404/GraphQL errors or CI-Lite/EAS triggers return 500 / missing job ids, we need *in-app* visibility into:

- which URL was called
- HTTP status + short body snippet
- which repo/branch/workflow was used

Without relying on console logs.

## What changed
- Added a tiny in-memory debug logger (`lib/debugOverlay.ts`) and a React hook (`hooks/useDebugEntries.ts`).
- Added a Debug Overlay modal in **ConnectionsScreen** (bug icon in the header).
- Logged request/response details for:
  - GitHub test (`GET /user`)
  - Expo test (`POST https://api.expo.dev/graphql`)
  - GitHub workflow dispatch (`/dispatches`)
  - Build job start (including "missing job id" hard error)

## Security
- Overlay data is sanitized via `redactSecrets()` and truncated.
- No tokens are shown.

## How to use
1. Open **Connections** screen.
2. Tap the **bug icon**.
3. Run the failing action (Expo test / workflow trigger / build start).
4. Re-open Debug Overlay and read the latest entries (newest first).
5. Use the trash icon to clear.
