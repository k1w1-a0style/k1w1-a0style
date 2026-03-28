# Patch 565 — EAS/Release-Build-Template-SoT weiter verkleinert

## Ziel
Den naechsten grossen Drift-Block nach Patch 564 reduzieren:
`WORKFLOW_EAS_BUILD` und `WORKFLOW_RELEASE_BUILD` nicht mehr als separate Inline-Kopien in `lib/diagnostics/workflowTemplates.ts` pflegen.

## Umsetzung

### 1) Neue gemeinsame SoT fuer EAS Build + Release Build
- Neue Datei: `shared/workflows/easBuildReleaseWorkflowTemplates.ts`
- Enthaelt beide Workflow-Strings als Shared-Exports:
  - `WORKFLOW_EAS_BUILD_TEMPLATE`
  - `WORKFLOW_RELEASE_BUILD_TEMPLATE`
- Inhalt ist byte-aligned zu den Live-Workflows:
  - `.github/workflows/eas-build.yml`
  - `.github/workflows/release-build.yml`

### 2) Diagnostics nur noch als Alias/Verdrahtung
- `lib/diagnostics/workflowTemplates.ts` importiert jetzt die Shared-Exports.
- `WORKFLOW_EAS_BUILD` und `WORKFLOW_RELEASE_BUILD` sind nur noch Alias-Exports auf diese Shared-SoT.
- `WORKFLOW_K1W1_TRIGGERED_BUILD` bleibt weiterhin lokal in Diagnostics (bewusst unveraendert in diesem Schritt).

### 3) Drift-Schutz auf echte neue SoT gezogen
- `scripts/check_workflow_template_drift.sh` prueft jetzt explizit:
  - Shared-EAS/Release-Exports sind parsbar,
  - Shared-EAS/Release == Live-Workflow-Dateien,
  - Diagnostics exportiert EAS/Release nur noch ueber Shared-Alias.
- `scripts/check_managed_workflows.sh` prueft denselben Shared-vs-Live-Vertrag.
- Fokussierter Invariant wurde nachgezogen:
  - `__tests__/patch414.workflowRefSot.invariants.test.ts` liest EAS/Release fuer den SoT-Abgleich jetzt aus `shared/workflows/easBuildReleaseWorkflowTemplates.ts`.

## Bewusste Grenze (nicht in diesem Patch)
- Kein Broad-Refactor der gesamten Workflow-Architektur.
- Live-Workflows bleiben weiterhin als Delivery-Artefakte unter `.github/workflows/` bestehen.
- Base-/Full-Template-Vergleiche bleiben bewusst aktiv; keine Entfernung dieser Guard-Ebene.
- `WORKFLOW_K1W1_TRIGGERED_BUILD` bleibt in `lib/diagnostics/workflowTemplates.ts` (naechster separater Schritt moeglich).

## Validierung
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/patch414.workflowRefSot.invariants.test.ts`
- `npm run test:silent -- --runInBand __tests__/invariants.strings.test.ts`
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`
