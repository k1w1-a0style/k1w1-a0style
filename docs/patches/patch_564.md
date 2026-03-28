# Patch 564 — EAS-Link-Template-SoT weiter vereinheitlicht

## Ziel
Den naechsten verbleibenden Drift-Hotspot nach Patch 563 verkleinern:
EAS-Link-Template-Inhalt nicht mehr separat im Diagnostics-Templateblock pflegen.

## Umsetzung

### 1) Gemeinsame EAS-Link-SoT eingefuehrt
- Neue Datei: `shared/workflows/easLinkWorkflowTemplate.ts`
- Enthält den EAS-Link-Workflow (`.github/workflows/eas-link.yml`) als exportierten String `WORKFLOW_EAS_LINK_TEMPLATE`.

### 2) Diagnostics auf Shared-SoT verdrahtet
- `lib/diagnostics/workflowTemplates.ts` importiert `WORKFLOW_EAS_LINK_TEMPLATE` und exportiert
  `WORKFLOW_EAS_LINK` nur noch als Alias auf diese Shared-Quelle.
- Damit entfaellt die separate inline gepflegte EAS-Link-Kopie im Diagnostics-Templateblock.

### 3) Drift-Schutz auf den echten Endvertrag angepasst
- `scripts/check_workflow_template_drift.sh` prueft nun:
  - Shared-EAS-Link-SoT ist parsbar,
  - Diagnostics exportiert EAS-Link ueber Shared-SoT,
  - Shared-SoT == Live-Workflow (`.github/workflows/eas-link.yml`),
  - Base-Template-Eintrag == Live-Workflow.
- `scripts/check_managed_workflows.sh` enthaelt dieselbe SoT-Verdrahtungs-Absicherung.
- Relevanter Invariant-Test wurde auf den Shared-EAS-Link-SoT-Pfad umgestellt:
  - `__tests__/patch417.ciWorkflowRefSot.invariants.test.ts`

## Bewusste Grenze (nicht in diesem Patch)
- Kein Broad-Refactor ueber alle Workflows.
- Live-Workflow-Datei und Base-Template-Eintrag bleiben weiterhin als eigene Artefakte bestehen;
  sie sind jetzt aber expliziter gegen die neue Shared-EAS-Link-SoT abgesichert.
- Kein beabsichtigter Workflow-Semantikwechsel.

## Validierung
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/patch417.ciWorkflowRefSot.invariants.test.ts`
- `npm run test:silent -- --runInBand __tests__/invariants.strings.test.ts`
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`
