# Patch 417 (V17)

## Summary

Hardens the remaining CI utility workflow ref contracts so manual and repository-dispatch entry points require an explicit target ref, while push/pull_request runs keep their legitimate event ref. Keeps a fail-closed syntax invariant for `lib/diagnostics/workflowTemplates.ts`, reads the embedded `WORKFLOW_EAS_LINK` export AST-based so future string-literal formatting changes do not break the invariant, and fails closed when the live `eas-link.yml`, the diagnostics export, and the base template JSON drift apart. The `(optional)` assertion in the invariant test is scoped to the ref-input description only, so the legitimate `(optional)` labels on `eas_project_id` and `expo_owner` do not cause false failures.

## Included

- `.github/workflows/ci-build.yml`
- `.github/workflows/ci-core.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/workflow-lint.yml`
- `.github/workflows/eas-link.yml`
- `lib/diagnostics/workflowTemplates.ts`
- `templates/expo-sdk54-base.json`
- `scripts/check_workflow_template_drift.sh`
- `__tests__/patch417.ciWorkflowRefSot.invariants.test.ts`

## Notes

- `workflow_dispatch` / `repository_dispatch` paths no longer invent refs silently.
- `push` / `pull_request` CI paths intentionally continue to use `github.ref`.
- Embedded `WORKFLOW_EAS_LINK` sources are kept 1:1 aligned with the live workflow, including the managed-by/workflow-version header lines.
- `__tests__/patch417.ciWorkflowRefSot.invariants.test.ts` parses `lib/diagnostics/workflowTemplates.ts` via TypeScript AST and reads `WORKFLOW_EAS_LINK` AST-based, so syntax drift still fails closed while plain string-literal formatting changes stay allowed.
- The `not.toContain` assertion for `(optional)` is scoped to the exact ref-input description string, not a substring match against the full file, to avoid false failures on the legitimately optional `eas_project_id` and `expo_owner` inputs.


## V17 follow-up

- Keeps the restored workflow/test/template contract intact and finalizes the delivered patch status/docs to V17.
- Marks `scripts/check_workflow_template_drift.sh` executable so the documented direct invocation works without needing `bash ...`.
