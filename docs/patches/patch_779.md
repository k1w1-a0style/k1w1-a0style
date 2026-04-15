# Patch 779 — RecoverabilityScopeStabilityClosure

## Ziel

Verbleibende echte Restfehler aus Patch 778 schließen, ohne Broad-Refactor:

1. Erfolgreiches Rollback darf nicht als `rollback_failed` klassifiziert werden.
2. Secure-Backup-Import muss repo-scoped EAS-IDs nach importiertem Repo-Kontext schreiben.
3. Recovery muss scope-stabil bleiben, auch wenn der aktive Repo-Kontext zwischenzeitlich wechselt.
4. Connections-Recovery muss neben Primaerwerten auch relevante Side-States konsistent wiederherstellen.

## Umsetzung

- `lib/recoverableCommit.ts`
  - Fehlerpfad in `runRecoverableCommit(...)` korrigiert:
    - Rollback-Erfolg -> `rollbackFailed=false`, Journal wird entfernt.
    - Nur echter Rollback-Fehler -> `rollbackFailed=true`, `rollback_failed`-Journal bleibt.

- `screens/AppInfoScreen/hooks/useAppInfoSecureBackupFlow.ts`
  - EAS-Repo-Scope fuer Import nicht mehr aus aktuellem UI-Repo, sondern aus `payload.github.linkedRepo`.

- `screens/ConnectionsScreen/hooks/useConnectionsSaveActions.ts`
  - Snapshot erweitert um `repoScope` + relevante Connection-Side-States (EAS-/Supabase-Lights).
  - Restore nutzt `snapshot.repoScope` statt veränderlicher Closure-Repo-Werte.
  - Restore stellt relevante Side-States explizit wieder her (Storage + UI-State).

- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`
  - Zusätzliche Restore-Callbacks in den Save-Action-Hook verdrahtet.

## Regressionen / Invariants

- `lib/__tests__/recoverableCommit.test.ts`
  - erfolgreicher Rollback bleibt `rollbackFailed=false` + kein `rollback_failed`-Journal.
  - echter Rollback-Fehler bleibt `rollbackFailed=true` + `rollback_failed`-Journal vorhanden.

- `__tests__/connectionsAndBackupRecoverable.invariants.test.ts`
  - Import-Repo-Scope aus Backup (`payload.github.linkedRepo`).
  - Connections-Recovery scope-stabil über Snapshot (`repoScope`) und Side-State-Restore verankert.

## Validation (kompakt)

```bash
npm run typecheck
npm run lint:ci
npm run test:silent -- --runInBand lib/__tests__/recoverableCommit.test.ts __tests__/connectionsAndBackupRecoverable.invariants.test.ts
npm run test:silent
npm run typecheck:edge
bash scripts/check_workflow_edge_contracts.sh
bash scripts/check_managed_workflows.sh
bash scripts/check_workflow_template_drift.sh
bash scripts/check_eas_manual_trigger_controls.sh
bash scripts/check_eas_production_credentials.sh
bash scripts/check_eas_strict_lockfile_policy.sh
bash scripts/check_edge_helper_visibility.sh
bash scripts/check_k1w1_handler_providers.sh
bash scripts/check_patch_docs_sync.sh
bash scripts/check_supabase_deploy_workflow.sh
npm run test:silent -- --runInBand edgeHelperVisibility.invariants.test.ts
npm run test:silent -- --runInBand k1w1Handler.providers.invariants.test.ts
bash scripts/check_release_readiness.sh
```
