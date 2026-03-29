# Patch 563 — Managed Workflow Templates auf gemeinsame SoT gezogen

## Ziel
Den Drift-Hotspot zwischen App-Infra und Edge-Dispatch im CI-Lite-Template-Bereich reduzieren,
ohne den sichtbaren Workflow-/Dispatch-Vertrag umzubauen.

## Umsetzung

### 1) Gemeinsame Template-SoT eingefuehrt
- Neue Datei: `shared/workflows/managedWorkflowTemplates.ts`
- Enthält die managed Workflow-Templates (inkl. `k1w1-ci-lite.yml` und `k1w1-ci-lite-autofix.yml`) als gemeinsame Exportquelle.

### 2) Infra und Edge auf denselben Exportpfad gezogen
- `infra/github/workflowTemplates.ts` ist jetzt ein schlanker Re-Export + Helper (`isKnownWorkflowTemplate`).
- `supabase/functions/github-workflow-dispatch/index.ts` importiert `WORKFLOW_TEMPLATES` aus derselben Shared-Datei.
- Damit entfaellt der doppelte grosse Inline-Template-Block im Edge-Dispatch.

### 3) Drift-Guards und Invariants auf Shared-SoT angepasst
- `scripts/check_workflow_template_drift.sh` prueft Template-Inhalte gegen die neue Shared-Quelle und stellt sicher, dass Infra + Edge den Shared-Pfad referenzieren.
- `scripts/check_managed_workflows.sh` prueft den Shared-Template-Stand statt eingebetteter Edge-Inline-Templates.
- Fokussierte Invariant-Tests wurden entsprechend aktualisiert:
  - `__tests__/patch399.managedWorkflowDrift.invariants.test.ts`
  - `__tests__/patch414.workflowRefSot.invariants.test.ts`

## Vertrags-/Verhaltensstand
- Kein beabsichtigter Verhaltenswechsel an Alias-Mapping, Bootstrap-Flow oder Retry-Flow.
- Ziel ist rein strukturell: kleinere Patch-Flaeche, weniger SoT-Bruch, geringeres Drift-Risiko.

## Validierung
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/patch399.managedWorkflowDrift.invariants.test.ts`
- `npm run test:silent -- --runInBand __tests__/patch414.workflowRefSot.invariants.test.ts`
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`
