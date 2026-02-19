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
