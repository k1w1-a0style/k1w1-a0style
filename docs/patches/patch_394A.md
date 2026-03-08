# Patch 394A

## Title
EAS Build strict lockfile policy for preview/production

## Why
The prior EAS build workflow still fell back to `npm install` when no lockfile was present. That is tolerable for development/bootstrap cases, but it is too loose for `preview` and `production`, where reproducibility matters.

## Changes
- `.github/workflows/eas-build.yml`
  - adds a `Determine strict lockfile policy` step
  - keeps `development` permissive
  - makes `preview` + `production` fail fast when neither `package-lock.json` nor `npm-shrinkwrap.json` exists
  - surfaces strict policy state in the workflow summary
- `lib/diagnostics/workflowTemplates.ts`
  - mirrors the stricter EAS build workflow policy to avoid autofix/template drift
- `.github/workflows/README.md`
  - documents the active `eas-build.yml` role and the new lockfile policy
- `scripts/check_eas_strict_lockfile_policy.sh`
  - guards workflow/template/doc invariants for this policy

## Validation
Run from project root:

```bash
bash scripts/check_eas_strict_lockfile_policy.sh
npm run typecheck
npm run lint:ci
npm run test:silent
```

## Notes
This patch intentionally does **not** add manual trigger inputs such as `strict_lockfile`. Those controls belong to the next patch layer so the policy change itself stays small and easier to verify.
