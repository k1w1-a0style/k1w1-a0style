# PATCH 50 – CI: Expo config smoke test robust parsing

## Problem
CI step **Expo config smoke test** failed with:
- `expo.extra.eas.projectId missing`

Cause: `expo config --json` output shape can vary. The script assumed `c.expo.*`.

## Fix
Read config via `(c.expo ?? c)` and then access `extra.eas.projectId`.

## Files
- `.github/workflows/ci-core.yml`
