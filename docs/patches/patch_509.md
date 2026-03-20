# Patch 509: Restliche Edge-Wildcard-CORS-Stubs auf request-gebundene Shared-Header gezogen

## Ziel

Die verbleibenden repo-weiten Edge-Functions mit alter `corsHeaders`-Wildcard-Nutzung sollten ohne Scope-Ausweitung auf dieselbe request-gebundene Shared-CORS-Wahrheit wie die bereits gehaerteten Kernpfade umgestellt werden. Dabei sollten auch bewusst deaktivierte/410-Legacy-Pfade keine `Access-Control-Allow-Origin: *`-Antworten mehr senden.

## Geaenderte Bereiche

- `supabase/functions/check-lint/index.ts`
- `supabase/functions/trigger-lint/index.ts`
- `supabase/functions/check-native-sync/index.ts`
- `supabase/functions/trigger-native-sync/index.ts`
- `supabase/functions/native-sync-report/index.ts`
- `supabase/functions/native-sync-report-ingest/index.ts`
  - diese disabled Legacy-Stubs importieren statt `corsHeaders` jetzt `corsHeadersForRequest` aus `../_shared/cors.ts` und liefern ihre lokalen `410`-Antworten weiter sichtbar mit `status: 410`, aber request-gebunden ueber `headers: corsHeadersForRequest(req)` aus.
- `supabase/functions/test/index.ts`
  - die lokale Erfolgsantwort nutzt ebenfalls `jsonResponse({ ok: true }, req)` statt einer Wildcard-CORS-Headerkopie.
- `__tests__/edgeCorsRequestBound.invariants.test.ts`
  - erweitert um eine Restpfad-Invariant, die fuer die verbleibenden Legacy-Stubs das Entfernen von `corsHeaders`/`Access-Control-Allow-Origin: *`, den sichtbaren `status: 410`-Vertrag der disabled Stubs sowie die weitere Nutzung von `handleCors(req)` und request-gebundenen Headern absichert; der `test`-Stub bleibt separat auf request-gebundenem `jsonResponse({ ok: true }, req)` abgesichert.

## Unveraendert / bewusst nicht im Scope

- `save_preview` bleibt unveraendert, weil dort bereits ein eigener origin-gebundener CORS-Helfer existiert und in diesem Patch keine zusaetzliche echte Wildcard-Restluecke zu schliessen war.
- Keine Auth-, Produktlogik-, Deno-Serve- oder sonstigen Security-/Edge-Refactors.
- Die bereits gehaerteten Kernpfade `k1w1-handler`, `github-workflow-runs` und `github-workflow-logs` wurden nur ueber bestehende Invariants mitgeprueft, aber inhaltlich nicht umgebaut.

## Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Ergebnis

- Keine `...corsHeaders`-Antworten mehr in den verbleibenden repo-weiten Edge-Restpfaden im Scope.
- Origin-Reflection und Preflight bleiben ueber die vorhandene Shared-CORS-Logik (`handleCors(req)` / `corsHeadersForRequest(req)`) intakt, waehrend die disabled Legacy-Stubs fuer CI sichtbar weiter `status: 410` tragen.
- Die bereits gehaerteten Kernpfade bleiben ueber denselben Invariant-Test weiterhin regressionsfest.
