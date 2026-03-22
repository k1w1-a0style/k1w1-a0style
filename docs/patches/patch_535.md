# Patch 535 — Preview-Edge-Fehlervertrag gezielt gehaertet

## Ziel
Die beiden Preview-Edge-Funktionen `save_preview` und `preview_page` sollten bei echten serverseitigen Problemen nicht mehr pauschal mit einem generischen `Internal Server Error` enden. Gleichzeitig durfte der bestehende Produktpfad „Supabase-Preview bevorzugt“ unveraendert bleiben und keine rohen DB-/Stack-/Secret-Details an den Client leaken.

## Analyse
- `supabase/functions/save_preview/index.ts` gab im Catch bisher nur `{ ok: false, error: "Internal Server Error" }` zurueck, auch wenn fehlende Server-Konfiguration, ungueltige Payloads oder DB-Insert-Probleme klar klassifizierbar waren.
- `supabase/functions/preview_page/index.ts` reduzierte den internen Catch ebenfalls auf einen blinden Generic-500 und unterschied beim Record-Lookup nicht sauber zwischen „nicht gefunden“ und serverseitigem DB-/Runtime-Problem.
- `hooks/previewHelpers.ts` konnte deshalb im Remote-Pfad meist nur Netzwerk-/Admin-Key-Faelle ehrlich erkennen; echte strukturierte Preview-Serverfehler fehlten als stabiler Vertrag.

## Aenderungen
- Neuer kleiner gemeinsamer Vertrag in `shared/previewErrorContract.ts` mit sicheren Preview-Fehlercodes:
  - `preview_env_missing`
  - `preview_db_error`
  - `preview_payload_invalid`
  - `preview_payload_too_large`
  - `preview_not_found`
  - `preview_expired`
  - `preview_response_too_large`
  - `preview_runtime_error`
  - `preview_unknown_internal_error`
- `supabase/functions/save_preview/helpers.ts`/`index.ts`
  - erzeugen strukturierte JSON-Fehlerantworten inkl. `code` und `x-k1w1-preview-error`-Header.
  - klassifizieren fehlende Preview-Server-Konfiguration, invalid/empty payload, zu grosse Payloads und DB-/Runtime-Probleme gezielt statt blindem Generic-500.
- `supabase/functions/preview_page/helpers.ts`/`index.ts`
  - unterscheiden beim Record-Lookup jetzt zwischen env-missing, DB-/Select-/Parse-Fehlern und echtem `not_found`.
  - markieren HTML-Fehlerseiten mit demselben strukturierten Fehlercode-Header und einem sicheren `data-preview-error-code`-Marker.
  - geben im Catch keinen generischen Internal-Server-Error mehr aus, sondern `preview_runtime_error` bzw. `preview_unknown_internal_error`.
- `hooks/previewHelpers.ts` + `types/preview.ts`
  - lesen `code` aus strukturierten Edge-Antworten in `invokeSavePreview(...)`.
  - mappen die Codes in `describeRemotePreviewFailure(...)` stabil auf ehrliche sichere UI-Texte, ohne fragile Text-Matching-Hoelle.
- `__tests__/previewEdgeErrorContract.test.ts`
  - deckt den neuen Fehlervertrag fuer Env-missing, invalid/empty payload, DB insert/select, `preview_page`-Runtime-Catch und Client-Mapping fokussiert ab.

## Wirkung
- Klassifizierbare Preview-Serverfehler landen nicht mehr blind als `Internal Server Error` beim Client.
- Der Client kann sichere, deutlich ehrlichere Ursachen wie Server-Konfigurationsfehler, Payload-Probleme oder DB-/Runtime-Probleme unterscheiden.
- Secret-/Token-/DB-/Stack-Leaks bleiben geblockt; nur kurze sichere Fehlermeldungen gehen an den Client.
- Der bestehende Produktpfad „Supabase-Preview bevorzugt“ bleibt unveraendert.

## Tests
- `npx jest --runInBand __tests__/previewEdgeErrorContract.test.ts __tests__/previewHelpers.test.ts __tests__/usePreview.serverContract.test.tsx __tests__/edgeErrorExposure.invariants.test.ts __tests__/patch514.buildPreviewEnvSharedHelpers.invariants.test.ts`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
