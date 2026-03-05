# Patch 370 — Restore patchlog references for patch 337

## Why
A test invariant (`__tests__/invariants.strings.test.ts`, I10) requires that `docs/patches/PATCHLOG_ROOT.md`
contains **both** references:
- `patch_337.md`
- `PATCH_337_NOTES.md`

Recent patch zips accidentally truncated `PATCHLOG_ROOT.md` so those references disappeared, causing CI to fail.

## What changed
- Rebuilt `docs/patches/PATCHLOG_ROOT.md` with a minimal structure that keeps the current recent entries
  and restores the required patch 337 references.

## Notes
This patch is intentionally minimal: it only restores the required index references, without changing any
CI-lite logic.
