# Patch 504: Edge CORS auf request-spezifische Shared-Header gehärtet

## Ziel

Verbleibende Wildcard-CORS-Nutzung in produktiven/geschuetzten Edge Functions wurde im engen Scope auf die vorhandene Shared-CORS-Logik aus `supabase/functions/_shared/cors.ts` umgestellt.

## Geaenderte Bereiche

- `supabase/functions/k1w1-handler/index.ts`
  - nutzt fuer alle lokalen Erfolgs-/Fehler-/405-Pfade jetzt `corsHeadersForRequest(req)` statt statischer `corsHeaders` mit `*`.
- `supabase/functions/k1w1-handler/helpers.ts`
  - reexportiert den request-gebundenen Shared-Helper sichtbar fuer den bestehenden Helper-Importpfad.
- `supabase/functions/github-workflow-runs/index.ts`
  - nutzt fuer alle JSON-Antworten request-spezifische CORS-Header aus `_shared/cors.ts` statt Wildcard-Headern.
- `supabase/functions/github-workflow-logs/index.ts`
- `supabase/functions/github-workflow-logs/helpers.ts`
  - enger angrenzender, ebenfalls geschuetzter Workflow-Edge-Pfad im selben CORS-Muster gleich mitgehaertet; lokale `jsonOk`/`jsonErr` laufen jetzt ueber `jsonResponse`/`errorResponse` aus `_shared/cors.ts`.
- `__tests__/edgeCorsRequestBound.invariants.test.ts`
  - neue Invariants fuer request-spezifische Origins, Preflight-Header und das Entfernen von Wildcard-CORS in den betroffenen Edge-Files.
- `__tests__/edgeHelperVisibility.invariants.test.ts`
- `scripts/check_edge_helper_visibility.sh`
  - auf den neuen `corsHeadersForRequest`-Reexport fuer `k1w1-handler` synchronisiert.

## Checks

- `npm run test:silent -- --runInBand __tests__/edgeCorsRequestBound.invariants.test.ts __tests__/edgeHelperVisibility.invariants.test.ts __tests__/edgeErrorResponseContracts.test.ts`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Ergebnis

- Keine `Access-Control-Allow-Origin: *`-Antworten mehr in den betroffenen geschuetzten Edge-Functions.
- OPTIONS-/Preflight-Handling bleibt ueber `handleCors(req)` unveraendert request-spezifisch.
- Auth-/Rate-Limit-/Request-Vertraege bleiben auf den vorhandenen Shared-Guards aufgebaut; geaendert wurde nur die CORS-Header-Erzeugung fuer lokale Antwortpfade.
