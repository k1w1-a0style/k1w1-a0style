# Patch 592: Test-/Warning-Stabilisierung fuer driftende Vertrags-Invariants

## Ziel
- Die zwei bekannten Fremdfails reproduzierbar bereinigen:
  - `__tests__/ciLiteHeaderWorkflow.invariants.test.ts`
  - `__tests__/patch403.workflowContracts.invariants.test.ts`
- Testvertrag auf den realen Codevertrag nach den Shared-SoT-/Hardening-Patches 586–591 synchronisieren.
- Sicherheits-/RBAC-/Branch-/Lockfile-Vertraege unveraendert strikt lassen (kein Greenwashing).

## Analyse

### 1) `ciLiteHeaderWorkflow.invariants`
- **Ursache:** Testdrift.
- Der Test erwartete weiterhin die alte Inline-Implementierung
  `if (dispatching || locatingRun || chainWaiting) { setHeaderState("running"); return; }`
  direkt in `useCiLiteWorkflow.ts`.
- Seit dem frueheren Refactor (Patch-582-Linie) liegt die SoT fuer diese Lampenlogik in
  `useCiLiteWorkflowStatusHelpers.ts::deriveCiLiteHeaderState(...)`.

### 2) `patch403.workflowContracts.invariants`
- **Ursache:** Testdrift durch SoT-Verlagerung.
- Der Test pruefte in Wrapper-/Alias-Dateien (`infra/github/workflowTemplates.ts`,
  `lib/diagnostics/workflowTemplates.ts`) auf konkrete Workflow-Strings (`package_manager`,
  `Auto-fix writeback currently supports npm-managed repos only` usw.).
- Nach den Shared-Template-Patches leben diese Inhalte korrekt in
  `shared/workflows/managedWorkflowTemplates.ts` und
  `shared/workflows/easBuildReleaseWorkflowTemplates.ts`.

## Umgesetzt

### A) Drift-Fix: CI Lite Header Invariant
- `__tests__/ciLiteHeaderWorkflow.invariants.test.ts`
  - Erwartung auf Inline-`setHeaderState("running")` entfernt.
  - Stattdessen:
    - Hook muss `deriveCiLiteHeaderState(...)` verwenden.
    - Helper muss Running-Guard bei `dispatching || locatingRun || chainWaiting` enthalten.

### B) Drift-Fix: Workflow-Contracts Invariant
- `__tests__/patch403.workflowContracts.invariants.test.ts`
  - Assertions fuer konkrete Template-Inhalte auf die echten Shared-SoT-Dateien umgezogen.
  - Zusaetzlich abgesichert, dass:
    - `infra/github/workflowTemplates.ts` auf Shared-Templates zeigt,
    - `supabase/functions/github-workflow-dispatch/index.ts` auf Shared-Templates zeigt,
    - `lib/diagnostics/workflowTemplates.ts` den EAS-Shared-Export verwendet.

## Warnings
- Reproduzierbar in allen npm-Laeufen:
  - `npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.`
- Bewertung: **Umgebungs-/NPM-Config-Thema**, nicht durch Repo-Code/Testvertrag verursacht.
- In diesem Patch bewusst dokumentiert, aber keine Dependency-/Toolchain-Hektik-Aenderung.

## Verifikation
- `npm run test:silent -- --runInBand __tests__/ciLiteHeaderWorkflow.invariants.test.ts __tests__/patch403.workflowContracts.invariants.test.ts`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_edge_helper_visibility.sh`
- `bash scripts/check_edge_rate_limit_retention.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Vertragswirkung
- **Kein Produktcode-Fix notwendig.**
- **Keine Security-Vertraege aus Patch 586–591 gelockert.**
- Reiner Testvertrags-/SoT-Drift-Fix plus Dokumentations-Sync.
