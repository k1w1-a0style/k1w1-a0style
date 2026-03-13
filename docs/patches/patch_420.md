# Patch 420

## Summary

Gezieltes Workflow-Ref/SoT-Hardening ohne Workflow-Umbau:

- `scripts/check_managed_workflows.sh` um explizite Verbots-Guards gegen implizite Ref-Fallbacks erweitert.
- Invariant-Coverage in `__tests__/patch417.ciWorkflowRefSot.invariants.test.ts` ergänzt, damit die neuen Guard-Klauseln selbst regressionssicher sind.

Schwerpunkt war, künftige stille Rückfälle auf `github.ref`/`github.ref_name`/`github.head_ref`/`default_branch` in produktiven ref-gesteuerten Flows früh zu blockieren und gleichzeitig die dokumentierte CI/CI-Lite-Ausnahme bewusst festzuhalten.

## Included

- `scripts/check_managed_workflows.sh`
- `__tests__/patch417.ciWorkflowRefSot.invariants.test.ts`
- `docs/patches/patch_420.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `PROJECT_CHECKLOG.md`
- `docs/TODO.md`

## Notes

- Keine Produkt-/App-Logik geändert.
- Keine Deploy-/Build-Semantik geändert.
- Nur Guard-/Invariant-Härtung + Doku-Sync.
