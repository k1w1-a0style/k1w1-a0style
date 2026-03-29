# Patch 594: Workflow-/Template-Drift-Fix fuer Manual Trigger Controls + Strict Lockfile Policy

## Ziel
- Die zwei roten Drift-Skripte sauber auf gruen bringen:
  - `scripts/check_eas_manual_trigger_controls.sh`
  - `scripts/check_eas_strict_lockfile_policy.sh`
- Ursache beheben (veraltete Check-SoT), ohne Sicherheits-/Workflow-Vertraege zu lockern.

## Reproduktion
- `bash scripts/check_eas_manual_trigger_controls.sh` -> Exit 1 ohne aussagekraeftige Fehlzeile.
- `bash scripts/check_eas_strict_lockfile_policy.sh` -> `template missing strict lockfile policy step`.

## Ursache
- Die betroffenen Checks gingen teilweise von einer **alten SoT-Annahme** aus:
  - direkter String-Match in `lib/diagnostics/workflowTemplates.ts`.
- Tatsaechliche Inhalts-SoT fuer diese Vertraege liegt in:
  - `shared/workflows/easBuildReleaseWorkflowTemplates.ts`
  - `shared/workflows/k1w1TriggeredBuildWorkflowTemplate.ts`
- `lib/diagnostics/workflowTemplates.ts` ist in diesem Pfad ein Wiring-/Alias-Layer, keine primäre Template-Inhaltsquelle.

## Umsetzung

### 1) `check_eas_manual_trigger_controls.sh`
- Auf echte SoT-Kette umgestellt:
  - Live-Workflows: `.github/workflows/eas-build.yml`, `.github/workflows/k1w1-triggered-build.yml`
  - Shared-SoT: `shared/workflows/easBuildReleaseWorkflowTemplates.ts`, `shared/workflows/k1w1TriggeredBuildWorkflowTemplate.ts`
  - Diagnostics-Wiring bleibt verifiziert (`WORKFLOW_EAS_BUILD_TEMPLATE`, `WORKFLOW_K1W1_TRIGGERED_BUILD_TEMPLATE`).
- Ergebnis: kein Greenwashing, sondern konsistente Vertragspruefung entlang der echten SoT.

### 2) `check_eas_strict_lockfile_policy.sh`
- Veralteten Template-Check auf `lib/diagnostics/workflowTemplates.ts` entfernt.
- Strikte Lockfile-Policy wird jetzt gegen echte Shared-SoT verifiziert:
  - `shared/workflows/easBuildReleaseWorkflowTemplates.ts`
- Diagnostics bleibt nur als Wiring-Guard enthalten:
  - Import + Re-Export auf `WORKFLOW_EAS_BUILD_TEMPLATE`.

### 3) Invariant-Schutz gegen Rueckdrift
- Neuer Test: `__tests__/easWorkflowManualLockfileChecks.invariants.test.ts`
  - sichert, dass die beiden Skripte weiterhin auf Shared-SoT + Wiring pruefen,
  - und nicht wieder auf alte direkte Diagnostics-Stringmatches zurueckfallen.

## Ergebnis
- Beide Drift-Skripte laufen wieder gruen.
- `check_managed_workflows.sh` und `check_workflow_template_drift.sh` bleiben ebenfalls gruen.
- Workflow-/Security-/Reproduzierbarkeitsvertrag wurde **nicht** aufgeweicht.
