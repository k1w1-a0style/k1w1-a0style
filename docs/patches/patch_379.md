# Patch 379: Prevent flattened CI-lite workflow YAML

## What changed
- Added a CI invariant that fails if the CI-lite workflow files (or their template sources) lose real newlines and become “flattened”.
- Added a defensive validation inside the `github-workflow-dispatch` edge function to **refuse** bootstrapping a workflow if the template looks flattened.

## Why
Flattened YAML breaks GitHub Actions parsing and, if bootstrapped, can overwrite otherwise-correct workflow files.

## Files
- `__tests__/invariants.strings.test.ts`
- `supabase/functions/github-workflow-dispatch/index.ts`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_379.md`
