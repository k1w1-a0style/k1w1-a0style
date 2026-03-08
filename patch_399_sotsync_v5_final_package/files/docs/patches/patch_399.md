# Patch 399

## Summary
Align CI Lite / Autofix workflow sources of truth and drift governance.

## Included
- add managed markers and workflow version `399` to CI Lite / Autofix workflows
- sync embedded templates in `infra/github/workflowTemplates.ts`
- sync bootstrap templates in `supabase/functions/github-workflow-dispatch/index.ts`
- tighten `scripts/check_workflow_template_drift.sh` to validate the correct source files
- align invariants to the new managed workflow contract
- preserve legacy `patch_337.md` + `PATCH_337_NOTES.md` references in `PATCHLOG_ROOT.md`

## Notes
This patch supersedes the earlier broken 399 packaging attempts and reflects the final intended source-of-truth model after patches 395–398.
