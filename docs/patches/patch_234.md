# Patch 234: Runtime robustness sweep (Gemini role-merge + Supabase Edge guard + config safety + logger cleanup)

## Goals
- Fix a real Gemini runtime failure case (consecutive same-role messages).
- Prevent confusing network failures when Supabase URL is not configured.
- Harden legacy config migrations against unknown/invalid providers.
- Finish remaining `console.log` migrations and small formatting hygiene.

## Changes
### Gemini (runtime fix)
- `lib/orchestrator.ts`
  - Merge consecutive Gemini `contents[]` entries with the same role (`user→user` / `model→model`) by concatenating `parts`.
  - Also normalize `signal` indentation for consistency (no behavior change).

### Supabase Edge URL (runtime fix)
- `lib/supabaseEdge.ts`
  - Added `requireSupabaseEdgeUrl()` which throws a clear, user-facing error if the URL is missing.
- Updated callers to use `requireSupabaseEdgeUrl()`:
  - `components/CiLiteHeaderButton.tsx`
  - `hooks/useGitHubActionsLogs.ts`
- `project/services/buildPollingService.ts`
  - Added an early guard: if Edge URL is missing → return `{ ok:false, error: ... }` instead of doing a confusing `fetch("/...")`.

### Config safety
- `contexts/AIContext.tsx`
  - Validate/normalize loaded providers from AsyncStorage (fallback to defaults if unknown).
  - Add a safety fallback in `resolveLegacyAutoMode()` if provider defaults are missing.

### Logger cleanup + minor format
- `lib/notificationService.ts`, `lib/retryWithBackoff.ts`, `lib/supabase.ts`
  - Replace remaining `console.log` with `logger.*`
- `contexts/ProjectContext.tsx`
  - Fix one indentation outlier (`setPreferredBuildProfile`)

## Apply
```bash
unzip -o k1w1-a0style_patch_234.zip -d .
rm -f k1w1-a0style_patch_234.zip
npm run test:silent
git add -A
git commit -m "Patch 234: runtime robustness sweep (Gemini merge + Supabase guard + config safety)"
git push
```
