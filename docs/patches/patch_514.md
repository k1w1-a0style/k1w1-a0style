# Patch 514: Shared-Env-Hygiene fuer Build-/Preview-nahe Edge-Pfade

## Ziel

Die verbliebenen direkten `Deno.env.get(...)`-Reads in den produktiven Build-/Preview-nahen Edge-Pfaden sollten im kleinen Scope auf dieselbe Shared-Helper-Linie gezogen werden wie bereits angrenzende Secret-/Auth-Pfade. Auth-, Guard-, CORS- und Produktlogik sollten dabei unveraendert bleiben.

## Vorheriger Ist-Zustand

Beim erneuten Audit dieses Restblocks zeigte sich: `check-eas-build`, `preview_page/helpers.ts` und `save_preview` liefen bereits ueber die kleine Shared-Helper-Linie aus `_shared/auth.ts`; der verbliebene produktive Parallelpfad sass noch im GitHub-Token-Lookup fuer `trigger-eas-build`.

Konkret:

- `supabase/functions/check-eas-build/index.ts` nutzte bereits `getSupabaseUrl()` und `getServiceRoleKey(req)`.
- `supabase/functions/preview_page/helpers.ts` nutzte bereits `getPreviewSupabaseUrl()`, `getPreviewServiceRoleKey()` und `getRuntimeEnv(...)` fuer `TEST_STRICT_CSP`.
- `supabase/functions/save_preview/index.ts` nutzte bereits dieselben Preview-Getter.
- `supabase/functions/trigger-eas-build/index.ts` war fuer Supabase-/Allowlist-Reads bereits aligned, zog sein GitHub-Token aber noch indirekt aus `_shared/github.ts`, wo `getGithubToken()` intern weiterhin direkte `Deno.env.get(...)`-Reads fuer `GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_API_TOKEN` enthielt.

Die Fachlogik war korrekt; offen war nur noch dieser kleine produktive Runtime-/Env-Mischpfad im Build-nahen Trigger-Stack.

## Geaenderte Bereiche

- `_shared/github.ts`
  - `getGithubToken()` nutzt jetzt dieselbe runtime-kompatible Shared-Helper-Linie ueber `getRuntimeEnv(...)`
  - die Alias-Kette `GITHUB_TOKEN` -> `GH_TOKEN` -> `GITHUB_API_TOKEN` bleibt unveraendert
- `trigger-eas-build`
  - bleibt unveraendert im Guard-/Build-Vertrag, zieht sein GitHub-Token aber nun ueber den bereinigten Shared-GitHub-Helper ohne direkten `Deno.env.get(...)`-Pfad
- Tests
  - der bestehende Patch-514-Invariant prueft jetzt zusaetzlich `_shared/github.ts` und den `trigger-eas-build`-GitHub-Token-Pfad
  - derselbe Test sichert weiter ab, dass `check-eas-build`, `preview_page/helpers.ts` und `save_preview` auf ihrer bestehenden Shared-Helper-Linie bleiben und dass die Guard-Vertraege unveraendert sind

## Bewusst nicht im Scope

- keine Aenderung an Auth-/Guard-Vertraegen
- keine CORS-Aenderung
- keine neue Service-Role-/Client-Architektur
- keine Aenderung an `k1w1-handler`-Provider-Secrets
- keine Broad-Refactors in anderen Edge-Functions oder GitHub-Workflow-Shared-Modulen jenseits dieses kleinen GitHub-Token-Helpers

## Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Ergebnis

- der letzte produktive Runtime-/Env-Mischpfad im Build-/Preview-nahen Trigger-Stack liest GitHub-Token jetzt ebenfalls ueber die gemeinsame Shared-Helper-Linie
- direkte `Deno.env.get(...)`-Reads sind damit im bearbeiteten Build-/Preview-Scope entfernt, ohne neue Secret-Architektur einzufuehren
- bestehende Guard-/Build-/Preview-Semantik bleibt unveraendert und wird durch gezielte Invariants regressionsfest gehalten
