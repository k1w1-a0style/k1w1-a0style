# Patch 778 — CoreIntegrityRecoverabilityAndSemantics

## Scope

- recoverable Multi-Store-Commit fuer Connections-Save
- recoverable Multi-Store-Commit fuer Secure-Backup-Import
- `gitDataApi.ts` entlang Commit/Tree/Ref-Kernlogik entschlackt (ohne API-Vertragsaenderung)
- Supabase-Runtime ohne globale `process.env`-Mutation
- clientseitige JWT/Admin-Key-Prechecks semantisch als UI-/Preflight-Helfer benannt
- durable Rate-Limit-Audit semantisch auf allowed/rejected getrennt
- produktnahes `projectFiles`-Typing (`ProjectFile[]`) geschlossen
- Review-/Checklog-/Runbook-SoT/Governance klarer getrennt

## Wesentliche Aenderungen

1. `lib/recoverableCommit.ts` fuehrt journaled recoverable commits ein (`runRecoverableCommit`, `recoverFromPendingJournal`).
2. `useConnectionsSaveActions.ts` und `useAppInfoSecureBackupFlow.ts` nutzen jetzt den Journal-Commit inkl. Recovery vor neuen Writes.
3. `lib/supabase.ts` + `lib/supabaseRuntimeConfig.ts`: Runtime-Config wird gelesen, aber keine Env-Bridge-Mutation mehr geschrieben.
4. `lib/auth/operatorJwt.ts` und `lib/security/isLikelyWellFormedAdminKeyForUiPrecheck.ts`: explizit nicht-authoritative Naming.
5. `supabase/migrations/20260415100000_edge_rate_limit_decision_semantics.sql` trennt durable decision (`allowed|rejected`) auditierbar.
6. `supabase/functions/_shared/auth/rateLimit.ts` verarbeitet/transportiert die decision-Semantik.
7. `infra/github/files/gitDataApi.ts` reduziert doppelte Git-Data-Orchestrierung auf wiederverwendbare Kernhelper.

## Validierung

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
npm run typecheck:edge
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
```
