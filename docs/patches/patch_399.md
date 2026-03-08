# Patch 399

## Summary
Finalize the CI Lite workflow source-of-truth sync by aligning the repo contract tests and restoring the legacy patch-337 references required by invariant I10.

## Included
- update `__tests__/invariants.selection.test.ts` to the current managed workflow contract (`workflow-version: 399`, `source_sha`, `github_sha`)
- restore explicit `patch_337.md` and `PATCH_337_NOTES.md` references in `docs/patches/PATCHLOG_ROOT.md`
- keep docs/checklog aligned with the final patch-399 state

## Validation
Run:

```bash
bash scripts/check_workflow_template_drift.sh
npm run typecheck
npm run lint:ci
npm run test:silent
```
