# Patch 425 – Diagnosis/Autofix/One-Click Build-Kette konservativ gehärtet

## Ziel

Die operative Kette zwischen Buildmodus (SoT), Diagnosis/Autofix und One-Click-Build auf echte Readiness ausrichten,
insbesondere für Diagnostic-/CI-Lite-/Repo-Branch-Konsistenz vor dem automatischen Buildstart.

## Änderungen

- `useDiagnosticScreen`:
  - mode-abhängige Pipeline-Filterlogik in pure Helper-Funktion `pipelineCheckAppliesToModes` extrahiert.
  - Verhalten unverändert, aber testbar gemacht (kein Architekturumbau).
- `useOneClickDeploy`:
  - neuen konservativen Readiness-Schritt `readiness` eingeführt.
  - One-Click blockiert jetzt explizit, wenn
    - Repo/Branch fehlen,
    - `diagnostic_last_ok` nicht `true` ist,
    - CI-Lite Lint/Typecheck nicht grün sind,
    - CI-Lite nicht zu Repo/Branch passt,
    - CI-Lite veraltet ist.
  - Buildstart erfolgt nur noch nach erfolgreichem Readiness-Gate.
- Regressionstests ergänzt/erweitert:
  - `__tests__/diagnosticModePipelineRules.test.ts`
  - `__tests__/oneClickDeploy.test.tsx` (Readiness-Fail + Happy-Path mit vollständigem Gate)
  - `__tests__/diagnosticSmartFix.fixableOnly.test.tsx` (Warn-only wird von `smartFix` bewusst nicht auto-applied)

## Warum minimal

- Keine neue Diagnostik-Architektur.
- Keine Broad-Refactors.
- Nur gezielte Guard-/Transparenz-Härtung im existierenden Flow.

## Verifikation

- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
