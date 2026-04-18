# Patch 734: Repo-SQL Hardening fuer bestaetigte Supabase-Live-Befunde (ohne Live-Mutation)

## Kontext

Dieser Durchlauf zieht **nur Repo-seitige SQL/Migrationsarbeit** nach bestaetigten Live-Befunden nach.
Es wurden **keine** Live-Supabase-Aktionen ausgefuehrt (kein Deploy, kein `db push`, keine Dashboard-Mutation).

## Aenderungen

1. Neue Migration `supabase/migrations/20260403060914_supabase_live_findings_hardening.sql`
   - re-assertet `build_jobs` fail-closed fuer `anon`/`authenticated` (policy + revoke + RLS on),
   - haertet Legacy-Funktion `cleanup_old_previews(integer)` falls vorhanden (`search_path`, execute nur `service_role`),
   - setzt fuer `signing_audit_log` explizite deny-policies (`select` + `write`) fuer `anon`/`authenticated`.
2. Neuer Invariant-Test `__tests__/patch734.supabaseLiveFindingsRepoHardening.invariants.test.ts`
   - sichert den Repo-Vertrag dieser Migration regressionsfest.

## Bewusst nicht blind gefixt

- `diagnostics_reports` wurde in diesem Patch **nicht** blind umgebaut.
  Der bestehende Policy-Mix im Repo ist historisch widerspruechlich (allow+deny-Footprints);
  ohne eindeutiges fachliches Zielbild wurde hier nur dokumentiert statt riskant umgeschrieben.

## Verifikation (lokal)

- `npm run typecheck`
- `npm run typecheck:edge`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/patch734.supabaseLiveFindingsRepoHardening.invariants.test.ts`
- `npm run test:silent -- --runInBand edgeHelperVisibility.invariants.test.ts`
- `npm run test:silent -- --runInBand k1w1Handler.providers.invariants.test.ts`
- `npm run verify:release`
