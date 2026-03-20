# Patch 511: Edge-Runtime-/Serve-Hygiene auf native Deno.serve-Linie gezogen

## Ziel

Die verbleibenden produktiven Supabase-Functions sollten im engen Scope dieselbe native Edge-Bootstrap-Linie nutzen, statt parallel alte `std@.../http/server.ts`-Imports, neuere `std`-Aliase und bereits vorhandenes `Deno.serve(...)` weiter gemischt im Repo zu lassen. Produktlogik, Auth-Guards, CORS-Vertraege und Response-Semantik sollten dabei unveraendert bleiben.

## Vorheriger Ist-Zustand

Vor der Umstellung waren diese aktiven Entry-Points noch betroffen:

- `supabase/functions/check-eas-build/index.ts`
- `supabase/functions/trigger-eas-build/index.ts`
- `supabase/functions/github-workflow-dispatch/index.ts`
- `supabase/functions/github-workflow-runs/index.ts`
- `supabase/functions/github-workflow-logs/index.ts`
- `supabase/functions/k1w1-handler/index.ts`
- `supabase/functions/save_preview/index.ts`
- `supabase/functions/preview_page/index.ts`
- `supabase/functions/create_codesandbox/index.ts`

Angrenzende Helper trugen zusaetzlich noch unnoetige `serve`-Imports oder -Reexports weiter:

- `supabase/functions/create_codesandbox/helpers.ts`
- `supabase/functions/preview_page/helpers.ts`
- `supabase/functions/k1w1-handler/helpers.ts`
- `supabase/functions/github-workflow-logs/helpers.ts`

## Geaenderte Bereiche

- die neun betroffenen Entry-Points nutzen jetzt direkt `Deno.serve(...)` statt importiertem `serve(...)`
- unnoetige alte `std/http/server.ts`-Imports bzw. `serve`-Reexports wurden in den bereinigten Helpern entfernt
- `__tests__/edgeHelperVisibility.invariants.test.ts` und `scripts/check_edge_helper_visibility.sh` wurden auf die neue Helper-Sicht aktualisiert
- `__tests__/patch511.edgeServeRuntimeHygiene.invariants.test.ts` deckt die vereinheitlichte Serve-Linie jetzt explizit regressionsfest ab

## Bewusst nicht im Scope

- keine Aenderungen an Request-Parsing, Auth-Guards, Rate-Limits oder CORS-Verhalten
- keine Broad-Modernisierung anderer `std`- oder Third-Party-Imports ausserhalb des `http/server`-Bootstraps
- keine neuen Helper-Architekturen oder Produktlogik-Aenderungen

## Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Ergebnis

- die verbleibenden produktiven Supabase-Functions laufen jetzt auf einer einheitlicheren nativen `Deno.serve(...)`-Bootstrap-Linie
- alte `std/http/server.ts`-Importdrift ist in den umgestellten Files entfernt
- gezielte Invariants verhindern, dass in diesen Edge-Pfaden erneut eine gemischte Serve-Welt aus nativer und alter importierter Bootstrap-API entsteht
