# Patch 514: Shared-Env-Hygiene fuer Build-/Preview-nahe Edge-Pfade

## Ziel

Die verbliebenen direkten `Deno.env.get(...)`-Reads in den produktiven Build-/Preview-nahen Edge-Pfaden sollten im kleinen Scope auf dieselbe Shared-Helper-Linie gezogen werden wie bereits angrenzende Secret-/Auth-Pfade. Auth-, Guard-, CORS- und Produktlogik sollten dabei unveraendert bleiben.

## Vorheriger Ist-Zustand

Vor diesem Patch war die Runtime-/Env-Leselogik in diesem Restblock noch gemischt:

- `supabase/functions/check-eas-build/index.ts` las `K1W1_SUPABASE_URL`/`SUPABASE_URL` und den Service-Role-Key lokal direkt.
- `supabase/functions/trigger-eas-build/index.ts` las sowohl die Supabase-Runtime-Env-Werte als auch Allowlist-/Regex-Env-Werte direkt per `Deno.env.get(...)`.
- `supabase/functions/preview_page/helpers.ts` las `PREVIEW_SUPABASE_URL`, `PREVIEW_SERVICE_ROLE_KEY` und `TEST_STRICT_CSP` lokal direkt.
- `supabase/functions/save_preview/index.ts` las `PREVIEW_SUPABASE_URL` und `PREVIEW_SERVICE_ROLE_KEY` lokal direkt.

Die Fachlogik war korrekt, aber die Runtime-/Env-SoT blieb unnoetig gemischt.

## Geaenderte Bereiche

- `_shared/auth.ts`
  - exportiert den bestehenden runtime-kompatiblen Env-Reader jetzt bewusst als kleinen Shared-Helper
  - `getSupabaseUrl()` deckt nun den produktiven Alias `K1W1_SUPABASE_URL` plus Fallback `SUPABASE_URL` ab
  - neue kleine Getter fuer `PREVIEW_SUPABASE_URL` und `PREVIEW_SERVICE_ROLE_KEY`
- `check-eas-build`
  - nutzt jetzt `getSupabaseUrl()` und `getServiceRoleKey(req)` statt paralleler lokaler Env-Reads
- `trigger-eas-build`
  - nutzt fuer Supabase-Env die Shared-Getter und fuer Allowlist-/Regex-Reads denselben Shared-Runtime-Reader statt direkter `Deno.env.get(...)`
- `preview_page/helpers.ts`
  - nutzt Preview-Getter und den Shared-Runtime-Reader fuer `TEST_STRICT_CSP`
- `save_preview`
  - nutzt dieselben Preview-Getter wie `preview_page`
- Tests
  - neuer Patch-514-Invariant sichert Shared-Helper-Nutzung, das Entfernen direkter Env-Reads in genau diesem Scope und unveraenderte Guard-Vertraege ab
  - bestehender Patch-510-Invariant wurde minimal auf den erweiterten `getSupabaseUrl()`-Alias aktualisiert

## Bewusst nicht im Scope

- keine Aenderung an Auth-/Guard-Vertraegen
- keine CORS-Aenderung
- keine neue Service-Role-/Client-Architektur
- keine Aenderung an `k1w1-handler`-Provider-Secrets
- keine Broad-Refactors in anderen Edge-Functions oder GitHub-Workflow-Shared-Modulen

## Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Ergebnis

- die betroffenen Build-/Preview-nahen Edge-Pfade lesen gemeinsame Runtime-/Env-Werte jetzt ueber dieselbe kleine Shared-Helper-Linie
- direkte parallele `Deno.env.get(...)`-Reads sind in diesem Scope entfernt
- bestehende Guard-/Build-/Preview-Semantik bleibt unveraendert und wird durch gezielte Invariants regressionsfest gehalten
