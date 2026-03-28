# Patch 566 — Triggered-Build-Template auf Shared-SoT gezogen

## Ziel
Den verbliebenen Workflow-Template-Driftblock nach Patch 565 reduzieren:
`WORKFLOW_K1W1_TRIGGERED_BUILD` nicht mehr als grosse Inline-Kopie in `lib/diagnostics/workflowTemplates.ts` halten.

## Umsetzung

### 1) Neue Shared-SoT fuer Triggered Build
- Neue Datei: `shared/workflows/k1w1TriggeredBuildWorkflowTemplate.ts`
- Export: `WORKFLOW_K1W1_TRIGGERED_BUILD_TEMPLATE`
- Inhalt ist byte-aligned zur Live-Datei `.github/workflows/k1w1-triggered-build.yml`

### 2) Diagnostics nur noch Alias/Verdrahtung
- `lib/diagnostics/workflowTemplates.ts` importiert jetzt die neue Shared-Quelle.
- `WORKFLOW_K1W1_TRIGGERED_BUILD` ist nur noch ein Alias auf `WORKFLOW_K1W1_TRIGGERED_BUILD_TEMPLATE`.
- Kein beabsichtigter Verhaltenswechsel am Triggered-Build-Vertrag (`repository_dispatch`, `workflow_dispatch`, `ref`, `profile`, `job_id`, `autofix`, `strict_lockfile`).

### 3) Drift-/Managed-Guards auf finalen Vertrag gezogen
- `scripts/check_workflow_template_drift.sh` prueft jetzt explizit:
  - Shared Triggered Build SoT vorhanden,
  - Shared Triggered Build == Live `.github/workflows/k1w1-triggered-build.yml`,
  - Diagnostics exportiert Triggered Build als Shared-Alias.
- `scripts/check_managed_workflows.sh` prueft denselben Shared-vs-Live + Alias-Vertrag.
- Fokussierte Invariants aktualisiert:
  - `__tests__/patch414.workflowRefSot.invariants.test.ts`
  - `__tests__/patch417.ciWorkflowRefSot.invariants.test.ts`

## Bewusst unveraendert
- Live-Workflow `.github/workflows/k1w1-triggered-build.yml` bleibt Delivery-Artefakt.
- Kein Broad-Refactor anderer Workflows.
- Marker-/Version-Vertrag bleibt unveraendert.

## Validierung
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/patch414.workflowRefSot.invariants.test.ts`
- `npm run test:silent -- --runInBand __tests__/patch417.ciWorkflowRefSot.invariants.test.ts`
- `npm run test:silent -- --runInBand __tests__/invariants.strings.test.ts`
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`
