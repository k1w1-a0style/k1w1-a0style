# Patch 119: fix preflight YAML quoting check (mkFix signature)

## What was broken
`lib/diagnostics/preflightChecks.ts` failed `tsc` because the YAML quoting check called `mkFix` with an object that included `label`. The helper is defined as `mkFix(upserts, deletes, explanation)`.

## Fix
- Call `mkFix(upserts, [], "Quote Workflow 'name' und step 'name' Werte")`.
- Keep the user-facing label on the surrounding `fix: { label, patch }` structure as expected by `PreflightCheckResult`.
