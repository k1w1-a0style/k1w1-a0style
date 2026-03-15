# Patch 438 — Supabase Edge Import-Hygiene (GitHub API Base entkoppelt)

## Ziel
Fragile Cross-Boundary-Imports von produktiven Supabase Edge Functions in den App-Pfad entfernen, ohne funktionalen Flow umzubauen.

## Befund
Mehrere produktive Edge Functions importierten `GITHUB_API_BASE` über den App-Pfad:
- `../../../shared/constants/github.ts`

Betroffen waren:
- `github-workflow-dispatch`
- `trigger-eas-build`
- `github-workflow-runs`
- `github-workflow-logs` (index + helpers)

Das ist deploy-fragil, weil Edge-Code damit von der App-Ordnerstruktur abhängt.

## Umsetzung (minimal)
- `GITHUB_API_BASE` in `supabase/functions/_shared/github.ts` als edge-nahe Konstante definiert.
- Obige Functions auf Import aus `../_shared/github.ts` umgestellt.
- Keine Request-/Response- oder Business-Logik geändert.

## Absicherung
- Neuer Invariant-Test: `__tests__/patch438.edgeImportHygiene.invariants.test.ts`
  - verhindert Re-Import von `../../../shared/constants/github.ts` innerhalb `supabase/functions/**`
  - prüft, dass `GITHUB_API_BASE` in `_shared/github.ts` vorhanden bleibt
