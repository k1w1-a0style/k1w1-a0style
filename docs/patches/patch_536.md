# Patch 536 — Preview-Page-Follow-up nach PR 398 sauber geschlossen

## Ziel
Die zwei echten Review-Restpunkte nach dem bereits eingefuehrten Preview-Edge-Fehlervertrag sollten minimal und ohne Contract-Umbau geschlossen werden:

1. Der Partial-Env-Fall im `preview_page`-Lookup (`PREVIEW_SUPABASE_URL` gesetzt, `PREVIEW_SERVICE_ROLE_KEY` fehlt) musste als `preview_env_missing` statt als `preview_db_error` enden.
2. Die browserseitig geoeffnete URL `preview_page` sollte bei Lookup-/Env-/DB-Fehlern weiter eine sichere HTML-Fehlerseite liefern statt rohes JSON, aber den strukturierten Fehlercode trotzdem ueber Header, HTML-Marker und HTTP-Status behalten.

## Aenderungen
- `supabase/functions/preview_page/index.ts`
  - prueft den Lookup-Pfad jetzt explizit vor dem REST-Call auf einen fehlenden Service-Role-Key und mappt diesen Partial-Env-Fall gezielt auf `preview_env_missing`.
  - nutzt fuer browser-facing Fehlerantworten im `preview_page`-Pfad konsequent wieder den HTML-Fehlerpfad statt JSON direkt an den Browser zu geben.
- `supabase/functions/preview_page/helpers.ts`
  - erweitert die Lookup-Klassifizierung um einen expliziten `missingServiceRoleKey`-Pfad statt fragiler Textauswertung.
  - kapselt den browserseitigen Preview-Fehlerpfad in einen kleinen Helper, der Status, `x-k1w1-preview-error` und `data-preview-error-code` konsistent zusammenhaelt.
- `__tests__/previewEdgeErrorContract.test.ts`
  - deckt den Partial-Env-Fall fuer `preview_page` explizit ab.
  - prueft, dass browser-facing Env-/DB-Fehler weiterhin `text/html` statt JSON liefern und Header/Marker/Status stabil bleiben.
- `__tests__/edgeErrorExposure.invariants.test.ts`
  - sichert ab, dass `preview_page` fuer diesen Fehlerpfad nicht wieder auf rohe JSON-Antworten zurueckfaellt.

## Wirkung
- `preview_page` klassifiziert den echten Partial-Env-Fall jetzt korrekt als `preview_env_missing`.
- Browser-/QR-Aufrufe von `preview_page` bleiben bei Env-/DB-/Lookup-Fehlern auf der sicheren HTML-Fehlerseite.
- Der bereits eingefuehrte strukturierte Preview-Fehlervertrag bleibt unveraendert maschinenlesbar ueber Header, HTML-Marker und Status erhalten.

## Tests
- `npm test -- --runInBand __tests__/previewEdgeErrorContract.test.ts __tests__/edgeErrorExposure.invariants.test.ts`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
