# Patch 428 – Stabilize flaky One-Click-Deploy timeout test

## Kontext
Beim zweiten kritischen Korrektheits-Check war die Suite erneut rot: `__tests__/oneClickDeploy.test.tsx` lief sporadisch in ein Jest-Timeout im Testfall "fails hard when signing key is missing (no skip)".

Ursache war keine fachliche Regression im Hook selbst, sondern ein zu knappes Zeitbudget für `waitFor` + Test-Timeout unter Last (große Gesamtsuite, RN-Testrenderer, AsyncStorage-Mocks).

## Minimaler Fix
- In `__tests__/oneClickDeploy.test.tsx` wurde der `waitFor`-Timeout im betroffenen Testfall von `6000` auf `12000` ms erhöht.
- Der Testfall-spezifische Jest-Timeout wurde von `15000` auf `30000` ms erhöht.

Es gab **keine** Produktionscode-Änderung im Deploy-/Backend-Flow; nur ein deterministischer Stabilitätsfix im Test.

## Verifikation
- `npm run test:silent -- --runInBand __tests__/oneClickDeploy.test.tsx`
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

Alle Checks grün.
