# Patch 161 — PR-7 Stage 3: Facade deprecation + audit

## Goal
Lock in refactor progress after PR-7 Stage 2 by:
- Keeping remaining facade entrypoints for backwards compatibility
- Making their status explicit (`@deprecated`)
- Adding an audit script to detect accidental facade imports

## Changes
### Code (no behavior changes)
- Mark facades as `@deprecated`:
  - `contexts/githubService.ts`
  - `contexts/projectStorage.ts`
  - `lib/templateChecklist.ts`
- Add audit script:
  - `scripts/refactor/pr7-facade-audit.sh`

### How to use
```bash
bash scripts/refactor/pr7-facade-audit.sh
```

## Verification
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

Expected: all green.

## Notes
Facades are intentionally kept to avoid breaking external imports.  
Once you are confident nothing outside the repo depends on them, we can remove them in a later patch.
