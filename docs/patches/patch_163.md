# Patch 163 — PR-7 Stage 4: strict facade import bans

## Goal
Now that all internal imports have been migrated off the facades (verified by the Stage 3 audit), we can enforce the rule at lint level: **facade imports are now errors**.

This prevents accidental regressions where new code starts importing from:
- `contexts/githubService`
- `contexts/projectStorage`
- `lib/templateChecklist`

## Changes
- `eslint.config.js`
  - `no-restricted-imports` severity changed from `warn` → `error`.
  - Messages still point to the correct replacements:
    - `infra/github/*`
    - `infra/storage/projectPersistence`
    - `lib/diagnostics/templates`

## Notes
- Facade files are intentionally still present (compatibility / historical imports), but **new/accidental usage now fails CI**.
- You can still run:
  - `bash scripts/refactor/pr7-facade-audit.sh`
  for a fast, repo-wide check.
