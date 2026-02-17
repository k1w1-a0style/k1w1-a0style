# Patch 156 — PR-6 Stage 2

This patch continues PR-6 by adding a barrel export for the template diagnostics helpers.

## Changes

- Add `lib/diagnostics/templates/index.ts` to centralize exports.
- Update `lib/templateChecklist.ts` to import/re-export via the barrel.

No runtime behavior changes intended.
