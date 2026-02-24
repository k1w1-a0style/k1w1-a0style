# Patch 243

## Purpose
Complete the remaining P3 logger sweep in `lib/` services and build-related services/hooks by removing leftover `console.*` calls.

## Changes
- `lib/notificationService.ts`: console warn/error → `logger.*` (structured `{ err }` where applicable).
- `lib/diagnostics/diagnosticUploader.ts`: console warn → `logger.warn` (+ add logger import).
- `lib/RateLimiter.ts`: console warn → `logger.warn` (+ add logger import).
- `lib/SecureKeyManager.ts`: console warn → `logger.warn` (+ add logger import).
- `lib/supabase.ts`: console warn → `logger.warn`.
- `project/services/buildPollingService.ts`: console warn → `logger.warn` (+ add logger import).
- `project/services/templateLoader.ts`: console error → `logger.error` (+ add logger import).
- `hooks/useBuildHistory.ts`: console warn/error → `logger.*` (+ add logger import).

## Verification
- `npm run test:silent`
- `npm run typecheck`
- `npm run lint:ci`
