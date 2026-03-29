# Patch 591: Repo/Branch-SoT Cleanup + Rate-Limit-Retention + Keystore-Contract Cleanup

## Ziel
- Repo-/Branch-SoT final auf `projectData.linkedRepo` / `projectData.linkedBranch` konsolidieren.
- Echte Retention fuer `public.edge_rate_limit_events` einfuehren.
- `android-keystore-generate` vom irrefuehrenden `branch`-Vertragsfeld bereinigen (fachlich bleibt `repo + mode`).

## Umgesetzt

### A) Repo/Branch Source of Truth
- `contexts/GitHubContext.tsx`
  - Keine konkurrierende Persistenz von `activeRepo` / `activeBranch` mehr auf `k1w1_github_active_repo` / `k1w1_github_active_branch`.
  - `activeRepo` / `activeBranch` sind jetzt abgeleitet aus `projectData.linkedRepo` / `projectData.linkedBranch`.
  - Legacy-Keys werden beim Hydrieren best-effort bereinigt.
- `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
  - Repo-/Branch-Schreibpfade konsolidiert auf `setLinkedRepo(...)`.
  - Kein fachlicher Doppel-Write `setActive* + setLinked*` mehr.
- `screens/AppInfoScreen/hooks/useAppInfoScreen.ts`
  - Secure-Backup-Import schreibt Repo/Branch nur noch ueber `setLinkedRepo(...)`.

### B) Backup/Import Compat-Migration
- `lib/appInfoScopedBackup.ts`
  - Snapshot-Felder auf `github.linkedRepo` / `github.linkedBranch` umgestellt.
  - Legacy-Felder `github.activeRepo` / `github.activeBranch` bleiben als Import-Compat erhalten.
  - Import priorisiert `linked*`, faellt nur wenn noetig auf Legacy-`active*` zurueck.

### C) Durable Rate-Limit Retention
- Neue Migration: `supabase/migrations/20260328100000_edge_rate_limit_events_retention.sql`
  - Fuegt `public.prune_edge_rate_limit_events(p_retention interval default interval '14 days') returns integer` hinzu.
  - Funktion loescht alte Events und gibt Anzahl geloeschter Zeilen zurueck (`GET DIAGNOSTICS ... ROW_COUNT`).
  - Execute-Rechte auf `service_role` begrenzt.
  - Nightly `pg_cron`-Schedule `prune-edge-rate-limit-events-nightly` (`17 3 * * *`) hinzugefuegt.

### D) Keystore-Generate Vertrag
- `supabase/functions/android-keystore-generate/index.ts`
  - Entfernt `branch` als Request-/Validation-/Response-Feld.
  - Oeffentlicher Vertrag der Route ist jetzt klar branch-unabhaengig (Kontext `repo + mode`).
- `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts`
  - Caller sendet kein `branch` mehr an `android-keystore-generate`.

## Tests / Checks
- `__tests__/githubContext.mirror.test.tsx`
- `__tests__/appInfoSecureBackup.test.ts`
- `__tests__/githubBranchRefHardening.contracts.test.ts`
- Neu: `__tests__/edgeRateLimitRetention.invariants.test.ts`
- `scripts/check_workflow_edge_contracts.sh` erweitert (branch-Vertrag bei keystore-generate verboten)
- Neu: `scripts/check_edge_rate_limit_retention.sh`

## Hinweise
- Keine Erweiterung des Keystore-DB-Scope auf `repo,branch,mode` in diesem Patch.
- Kein erneuter Umbau der RBAC-/Secret-Grundlinie aus Patch 588.
