# Patch 228: Dev commands doc + search without ripgrep

Date: 2026-02-20

## Goal

Make the repo easier to work with on minimal environments (where `rg` is not installed), while keeping a single, obvious place for the common commands.

## Changes

- Added `docs/DEV_COMMANDS.md`
  - Standard check commands
  - Search recipes using `git grep` / `grep` / `find+xargs`
  - Patch-apply command template (matches the terminal snippet format)
- Linked the doc from `docs/INDEX.md`
- README: added a small note that `rg` is not required + the alternatives

## Follow-ups

- Optional: add an `npm run grep` helper if you want a single command (not done here to avoid package.json churn).
