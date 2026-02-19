# Patch 215

## Goal
Continue the “single source of truth” cleanup:

- **GitHub AsyncStorage keys** live in one place (no more duplicated string keys).
- **Supabase Edge Function names** live in one place (no more hardcoded endpoints sprinkled around).

## Changes

### GitHub storage keys are centralized
- Added `GITHUB_STORAGE_KEYS` in `shared/constants/github.ts`.
- `contexts/GitHubContext.tsx` now imports and uses those keys.

### Supabase Edge function names are centralized
- Added `SUPABASE_EDGE_FUNCTIONS` in `shared/constants/supabase.ts`.
- `hooks/useGitHubActionsLogs.ts` now builds URLs from `SUPABASE_EDGE_FUNCTIONS`.

## Why this matters
This prevents subtle drift where one screen stores “active repo” under one key but another screen reads a different key / endpoint.

## Follow-ups (known remaining drift)

Patch 215 intentionally only migrated the first wave of call-sites.
The following hardcodes still exist and should be migrated in the next patch:

- `components/CiLiteHeaderButton.tsx`: still builds URLs with literal endpoints (`github-workflow-runs`, `github-workflow-dispatch`).
- `project/services/buildStartService.ts`: still invokes `trigger-eas-build` as a literal.
- `project/services/buildPollingService.ts`: still calls `check-eas-build` as a literal (and duplicates `getSupabaseEdgeUrl`).
- `hooks/usePreview.ts`: still invokes `save_preview` as a literal.
