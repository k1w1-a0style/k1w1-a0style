# Patch 777: EdgeTypecheckReleaseGateClosure

## Scope

Gezielter Abschluss der offenen Edge-/Release-Blocker aus Patch 776:
- `typecheck:edge` wieder voll gruen
- `verify:release` wieder lauffaehig im lokalen No-Live-Env-Modus (`OK_WITH_SKIPS`)

## Aenderungen

- `supabase/functions/check-eas-build/helpers.ts`
  - `catch(() => null)` explizit mit Rueckgabetyp annotiert (`(): null => null`) fuer `noImplicitAny`.
- `supabase/functions/trigger-eas-build/index.ts`
  - gleicher `catch`-Rueckgabetyp-Fix fuer Commit-JSON-Parse.
- `supabase/functions/check-eas-build/routeCore.ts`
  - `createSupabaseClient`-Vertrag auf einen robusten, kompatiblen lokalen Supabase-Client-Contract ausgerichtet (inkl. `update(...).eq(...)`-Pfad).
- `supabase/functions/trigger-eas-build/routeCore.ts`
  - analoger Supabase-Client-Contract-Fix.
  - `flow.ok`-Narrowing explizit (`flow.ok === false`) fuer sicheren Zugriff auf Fehlerzweig-Felder.
  - Insert-Result-ID wird robust numerisch validiert, bevor sie als Job-ID weiterverwendet wird.
- `supabase/functions/_shared/external-types.d.ts`
  - `SupabaseQueryBuilderLike` um `update(...)` erweitert, passend zur realen Nutzung in Edge-Routen.
- `scripts/check_edge_live_env_readiness.sh`
  - fehlende Live-Env (`EDGE_BASE_URL`/`EDGE_OPERATOR_JWT`) ist jetzt ein sauberer SKIP statt harter Fehl-Abbruch, damit `verify:release` lokal weiter als `OK_WITH_SKIPS` laufen kann.

## Nicht geaendert (bewusst)

- keine Aenderung an Live-Contract-Pruefungen selbst (`check_edge_live_contracts.sh` bleibt env-gated)
- kein Broad-Refactor ausserhalb des direkt betroffenen Edge-/Release-Scopes
