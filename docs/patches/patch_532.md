# Patch 532 — k1w1-handler Fehlervertrag fuer Provider-/Env-/Modellfehler gehaertet

## Ziel
Der produktive KI-Fehlerpfad rund um `supabase/functions/k1w1-handler` soll bei klassifizierbaren Provider-/Env-/Upstream-Problemen nicht mehr auf ein unbrauchbares generisches `Internal Server Error` kollabieren. Der Client soll sichere, aber brauchbare Fehlerklassen und ehrliche Kurzmeldungen erhalten.

## Analyse
- `supabase/functions/k1w1-handler/helpers.ts` erzeugt bereits aussagekraeftige interne Fehlerformen, z. B. fehlende Provider-Keys (`*_API_KEY not set in Edge env`) oder Provider-HTTP-Fehler (`provider_http_<status> (model=...)`).
- `supabase/functions/k1w1-handler/index.ts` reduzierte diese Fehler bisher im Catch-Block weitgehend auf `Invalid request payload.` oder `Internal Server Error`.
- `lib/orchestrator/k1w1Edge.ts` las im Fehlerfall primär nur rohe `error`-Strings bzw. HTTP-Status und konnte daher klassifizierte Ursachen nicht sauber an den Chat weitergeben.

## Änderungen
- `supabase/functions/k1w1-handler/helpers.ts`
  - fuehrt einen kleinen strukturierten Fehlervertrag mit sicheren Codes ein: `provider_env_missing`, `provider_http_401`, `provider_http_403`, `provider_http_404`, `provider_http_429`, `provider_model_not_found`, `provider_upstream_error`, `invalid_request_payload`, `unsupported_provider`, `unknown_internal_error`.
  - klassifiziert bestehende interne Helper-Fehler in diese Codes, inklusive Trennung von Env-Key-Fehlern, 401/403/429 und Modell-/404-Faellen.
  - erzeugt bewusst nur gekuerzte, client-sichere Meldungen ohne rohe Upstream-Bodies oder Secret-Namen.
  - nutzt fuer Provider-Env-Lookups `getRuntimeEnv(...)`, damit Jest/Typecheck den Helper-Vertrag weiter sauber importieren koennen.
- `supabase/functions/k1w1-handler/index.ts`
  - gibt strukturierte Fehlerpayloads mit `code`, `error`, `status`, optional `provider`/`model` zurueck statt generischem 500-Text.
  - behaelt parse-/Validation-Fehler sauber als `invalid_request_payload`.
  - loggt intern weiter den rohen Fehler, aber nur die klassifizierte, sichere Payload geht an den Client.
- `lib/orchestrator/k1w1Edge.ts`
  - liest strukturierte Edge-Fehlerpayloads jetzt direkt aus `supabase.functions.invoke(...)`.
  - nutzt Codes/Payloads fuer ehrliche Chat-Meldungen statt generischem `Edge-Request fehlgeschlagen (...)` oder blindem `Internal Server Error`.
  - bleibt bei Timeout/Abort ohne Broad-Refactor auf dem bestehenden Verhalten.
- Tests
  - neue gezielte Klassifizierungs-Regressionen fuer fehlenden Provider-Env-Key, Upstream-401, Upstream-429 und Modell-nicht-gefunden/404.
  - Orchestrator-Regression stellt sicher, dass strukturierte Edge-Fehler im Clientpfad statt generischem 500-Text landen.
  - Invariant fuer Edge-Error-Exposure auf strukturierten statt generischen Fehlervertrag aktualisiert.

## Wirkung
- Nutzer sehen jetzt unterscheidbare, ehrliche Fehler wie fehlende serverseitige Provider-Konfiguration, Auth-/Permission-Probleme zum Upstream, Rate-Limits, Modell-nicht-verfuegbar oder allgemeinen Upstream-Fehler.
- Rohpayloads, API-Keys und lange Upstream-Responses werden weiterhin nicht an den Client geleakt.
- Klar klassifizierbare Providerfehler enden nicht mehr standardmaessig als `Internal Server Error` im Chat.

## Tests
- `npx jest --runInBand __tests__/k1w1Handler.errorClassification.test.ts lib/__tests__/orchestrator.test.ts __tests__/edgeErrorExposure.invariants.test.ts`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
