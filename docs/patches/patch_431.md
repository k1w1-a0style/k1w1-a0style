# Patch 431 — Diagnostic-Status korrekt auf Repo/Branch scoped

## Kontext
Bei der System-Audit-Prüfung blieb eine operative E2E-Lücke: `diagnostic_last_ok` war global gespeichert.
Damit konnte ein grüner Diagnose-Lauf für Repo/Branch A fälschlich als Freigabe für Repo/Branch B wirken.

## Änderungen (minimal)
- Neue Key-Helferfunktion `diagnosticLastOkKeyForSelection(linkedRepo, linkedBranch)` in `lib/storageKeys.ts`.
- DiagnosticScreen schreibt Ergebnis jetzt **scoped** auf `diagnostic_last_ok::<repo>::<branch>` und zusätzlich legacy global (Backward Compatibility).
- Build-Readiness (`assertBuildReadiness`) liest zuerst scoped, dann legacy fallback.
- Build-Preconditions im EnhancedBuildScreen zeigen denselben scoped/legacy Zustand.
- Jest:
  - neue Gate-Tests für scoped Diagnostic-Readiness,
  - neue StorageKey-Tests für Key-Bildung/Fallback.

## Warum nötig
Schließt einen realen Cross-Repo/Cross-Branch-Freigabe-Fehler in einem kritischen Hauptpfad (Diagnosis → Build-Start).

## Verifikation
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
