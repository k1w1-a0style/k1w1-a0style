# Patch 735 — diagnostics_reports Entscheidungsvorlage + search_path Follow-up

## Kontext / Root Cause

- `diagnostics_reports` hatte im Migrationsverlauf widersprüchliche Read-Intentionen (public → authenticated → deny).
- Zusätzlich blieb ein App-seitiger Client-Read-Pfad bestehen, obwohl der aktuelle Repo-Sicherheitsstand `anon`/`authenticated` deny-read abbildet.
- Für Trigger-/Hook-Helfer war ein kleiner, risikofreier `search_path`-Re-Assert sinnvoll, um historische Reihenfolgen robust abzufangen.

## Änderungen

1. **Policy-Klärung ohne Blind-Fix**
   - Neue Decision-Note: `docs/reviews/diagnostics_reports_policy_decision_2026-04-03.md`.
   - Ergebnis: in diesem Lauf kein riskanter Policy-Toggle; Thema als fachliche A/B-Entscheidung explizit dokumentiert.

2. **Low-risk SQL-Härtung (`search_path`)**
   - Neue idempotente Migration `supabase/migrations/20260403010000_search_path_followup.sql`.
   - Re-assertet explizites `search_path = public, pg_temp` für:
     - `public._diagnostic_upload_guard()`
     - `public.cleanup_expired_previews()`

3. **Invariants / Doku-SoT**
   - Neuer Test: `__tests__/patch735.diagnosticsReportsAndSearchPathFollowup.invariants.test.ts`.
   - TODO/Review/Patchlog/Checklog auf neuen Stand synchronisiert.

## Verifikation

- `npm run typecheck`
- `npm run typecheck:edge`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/patch735.diagnosticsReportsAndSearchPathFollowup.invariants.test.ts`
- `npm run verify:release`
- `bash scripts/check_patch_docs_sync.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_eas_manual_trigger_controls.sh`
- `bash scripts/check_eas_production_credentials.sh`
- `bash scripts/check_eas_strict_lockfile_policy.sh`
- `bash scripts/check_edge_helper_visibility.sh`
- `bash scripts/check_k1w1_handler_providers.sh`
- `bash scripts/check_supabase_deploy_workflow.sh`
