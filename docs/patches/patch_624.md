# Patch 624 - P0-RLS-/Policy-Livefix fuer lint/native-sync als Repo-Migration kanonisiert

## Kontext
Der P0-Fix wurde am 2026-03-30 bereits live in Supabase ausgefuehrt, war aber noch nicht als Migration im Repo vorhanden. Damit bestand ein Live-vs-Repo-Drift fuer drei Legacy-Tabellen.

## Ziel
Exakt den live ausgefuehrten SQL-Fix als **eine** neue Repo-Migration nachziehen, ohne Scope-Creep.

## Umsetzung
- Neue Migration: `supabase/migrations/20260330000000_p0_rls_policy_fix_lint_and_native_sync.sql`
- Inhaltlich exakt uebernommen:
  1. `public.lint_jobs`
     - `DROP POLICY IF EXISTS "Service role full access lint_jobs"`
     - `CREATE POLICY "deny_anon_authenticated_lint_jobs" ... USING (false) WITH CHECK (false)`
  2. `public.native_sync_jobs`
     - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
     - `CREATE POLICY "deny_anon_authenticated_native_sync_jobs" ... USING (false) WITH CHECK (false)`
  3. `public.native_sync_reports`
     - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
     - `CREATE POLICY "deny_anon_authenticated_native_sync_reports" ... USING (false) WITH CHECK (false)`

## Scope-Guard
- Keine weiteren Tabellen angefasst.
- Keine Functions, Trigger, Grants, Hooks, Deployments oder Secrets angefasst.
- Keine Produktcode-Aenderung.
- Keine inhaltliche SQL-Aenderung gegenueber der Live-Quelle.

## Verifikation
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
