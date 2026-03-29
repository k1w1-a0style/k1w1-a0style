# Patch 613: Dispatch/Bootstrap-Semantik trennen (workflow dispatch bleibt mutation-free)

## Problem

Der normale Workflow-Dispatch-Pfad war semantisch nicht rein:

- `infra/github/workflows.ts::triggerWorkflow(...)` konnte bei `404` (fehlender Workflow) still in `createOrUpdateFile(...)` kippen und Workflows ins Ziel-Repo schreiben.
- `supabase/functions/github-workflow-dispatch` hatte denselben impliziten Bootstrap-/Writeback-Fallback.

Damit war fuer Operatoren schwer erkennbar, ob ein Aufruf nur dispatcht oder nebenbei Repo-Mutationen ausfuehrt.

## Aenderung

1. **Dispatch fail-closed/mutation-free gemacht**
   - `infra/github/workflows.ts` entfernt den 404→Bootstrap-Write-Pfad vollstaendig.
   - `supabase/functions/github-workflow-dispatch` entfernt implizites Bootstrap/Repo-Write im normalen Dispatch.

2. **Klare Fehlersemantik bei fehlendem Workflow**
   - Beide Dispatch-Pfade signalisieren fehlenden Workflow jetzt explizit als `missing_workflow` statt stiller Mutation.
   - Hinweise verweisen auf explizite Repair-/Provisioning-Flows.

3. **Vertragschecks/Invariants nachgezogen**
   - Neue Invariant `__tests__/patch613.dispatchBootstrapSeparation.invariants.test.ts`.
   - `__tests__/githubBranchRefHardening.contracts.test.ts` ergaenzt um 404/mutation-free Dispatch-Vertrag.
   - `scripts/check_workflow_edge_contracts.sh` um No-Bootstrap-Assertions fuer `github-workflow-dispatch` erweitert.

4. **Doku synchronisiert**
   - README / PROJECT_CHECKLOG / PATCHLOG_ROOT auf Patch 613 gehoben.
   - `docs/06-build-readiness.md`, `docs/04-risk-hotspots.md`, `docs/EDGE_FUNCTIONS_STATUS.md` beschreiben den getrennten Dispatch-vs-Repair-Vertrag.

## Operativer Vertrag ab Patch 613

- **Normaler Dispatch**: versucht nur Triggern (Dateiname/ID), schreibt nichts ins Repo.
- **Fehlender Workflow (`404`)**: klarer `missing_workflow`-Fehler.
- **Repair/Bootstrap**: nur ueber explizite AutoFix-/Provisioning-Pfade (nicht implizit in Dispatch).
