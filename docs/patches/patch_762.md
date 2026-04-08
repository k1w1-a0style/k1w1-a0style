# Patch 762 — Hygiene-/Drift-Follow-up (eng)

## Scope
Kleine Nachzuege nach PR 591:
- verify_jwtVisibilityHygiene
- SilentCatchHygiene
- ProductConsoleLogCleanup
- WorkflowHygieneNarrowFollowup
- AuthMarkerDebtFollowup

## Umsetzung
- `scripts/check_workflow_edge_contracts.sh` von fragilem Monolith-Marker-Matching auf modulare Auth-Zieldateien umgestellt (`auth/jwt.ts`, `auth/scoped.ts`, `auth/runtime.ts`, `auth/admin.ts`).
- Marker-Kommentare in `supabase/functions/_shared/auth.ts` entfernt (Facade bleibt unveraendert).
- Neuer Check: `scripts/check_verify_jwt_visibility.sh`.
- `scripts/check_release_readiness.sh` fuehrt den neuen verify_jwt-Sichtbarkeitscheck aus.
- Produktive `console.log` in
  - `supabase/functions/k1w1-handler/index.ts`
  - `supabase/functions/preview_page/index.ts`
  auf `console.info` umgestellt.
- SilentCatch-Re-Scan: keine verbleibenden stillen Catchs im produktiven Runtime-Scope.

## Verifikation
- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_verify_jwt_visibility.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run -s docs:lint`
- `npm run -s docs:check:contracts`
