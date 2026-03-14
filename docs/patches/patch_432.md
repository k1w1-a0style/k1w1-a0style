# Patch 432 — Ownership- und Change-Permissions-Audit

## Kontext
Nach der Repo/Branch-SoT-Härtung bestand weiter ein Ownership-Risiko zwischen Template/Baseline-Daten,
KI-Writeback und Diagnosis/Autofix: die Regeln waren verteilt und nicht als gemeinsame Wahrheit erzwungen.

## Änderungen (minimal)
- Neue zentrale Ownership-Guards in `lib/projectOwnership.ts`:
  - Template-/Baseline-nahe Pfade sind im Runtime-Änderungsfluss read-only.
  - Chat/KI darf kritische Projekt-/Pipeline-Dateien nicht blind überschreiben.
  - Diagnosis/Autofix darf nur in einem kuratierten, fix-orientierten Pfad-Set schreiben.
- `lib/fileWriter.ts` nutzt die Ownership-Guards explizit für den Chat-Apply-Flow.
- `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts` blockiert Patches, die außerhalb des Diagnosis/Autofix-Scopes liegen.
- Neue Jest-Regressionen in `lib/__tests__/projectOwnership.test.ts` sichern:
  - Template/Baseline-Schutz,
  - KI-Blockierung auf kritischen Pfaden,
  - Diagnosis/Autofix-Scope,
  - konservative Konfliktbehandlung Chat vs. Diagnosis,
  - Schutz bei Chat-Apply-Flow.

## Warum nötig
Schafft eine klare, erzwungene Ownership-Wahrheit für drei bisher nur implizit gekoppelte Flows und reduziert Risiko von gegenseitigem Übersteuern.

## Verifikation
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
