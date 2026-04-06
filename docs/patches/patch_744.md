# Patch 744 — Release-/Workflow-Trust-Drift: CI-Lite Contract + EAS-Link Writeback-Haertung

## Ziel

Kleiner kombinierter Drift-Durchlauf im Release-/Trust-/Workflow-Scope:
- reproduzierbaren roten Gate-Punkt ehrlich nachweisen und schliessen
- Workflow-Writeback im manuellen EAS-Link-Pfad enger absichern
- Review-/Checklog-/Patchlog auf den realen Gate-Verlauf synchronisieren

## Umsetzung

1. `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts` fuehrt den geforderten Contract-Marker wieder exakt (`JWT role=build_admin (oder service_role fuer Server-Caller)`), damit `check_workflow_edge_contracts.sh` den CI-Lite-Operatorvertrag wieder korrekt validiert.
2. `.github/workflows/eas-link.yml` wurde fuer Writeback-Sicherheit gehaertet:
   - top-level `permissions` auf `contents: read`
   - `contents: write` nur job-scoped im Link-Job
   - Commit-Push nur fuer explizite sichere Remote-Branches (kein SHA, kein unsafe Ref, kein missing remote head)
   - kein stilles Push-`|| true` mehr
3. Doku-SoT auf echten Verlauf gezogen (`README.md`, `docs/INDEX.md`, `docs/TODO.md`, `docs/TESTING_GUIDE.md`, `docs/FRESH_CHECKOUT_GREEN_PATH.md`, `docs/reviews/Review.md`, `PROJECT_CHECKLOG.md`, `docs/patches/PATCHLOG_ROOT.md`).

## Tests / Checks

- `bash scripts/check_workflow_edge_contracts.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `bash scripts/check_release_readiness.sh`
- `npm run docs:lint`
- `npm run docs:check:contracts`
- `bash scripts/check_patch_docs_sync.sh`

## Nicht-Ziele

- Kein Broad-Refactor ausserhalb des Release-/Workflow-/Doku-Drift-Scopes.
- Keine Aenderung an produktiven Build-/Deploy-Verhalten jenseits der benoetigten Writeback-Haertung.
