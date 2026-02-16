# Patch 149 (V3.1 PR-3: Polling extract + single poller)

## Goal
Eliminate duplicate polling implementations by extracting the **network polling logic** into a shared service,
while keeping **`hooks/useBuildStatus.ts`** as the **single hook** responsible for state + retry logic.

## Changes
- **ADD:** `project/services/buildPollingService.ts`
  - `pollBuildStatusOnce(jobId)` to fetch + normalize build status responses
  - `isFinalStatus(status)` helper
  - `fetchWithTimeout(...)` + `getSupabaseEdgeUrl()` centralized
- **UPDATE:** `hooks/useBuildStatus.ts`
  - Uses `pollBuildStatusOnce(...)` instead of embedding request/parse logic
  - No behavior change intended: same error handling & callbacks
- **ADD:** `scripts/refactor/pr3-polling-extract.sh` (optional sanity check)

## Notes
- This patch is intentionally **behavior-preserving**:
  - Network errors still throw and are handled by the hook
  - HTTP/JSON parse issues are normalized into `{ ok: false, error, raw }`

## Verification
Run:
- npm run typecheck
- npm run lint:ci
- npm run test:silent
