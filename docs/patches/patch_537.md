# Patch 537 — Preview-Page-Timer-Cleanup im Partial-Env-Fall geschlossen

## Ausgangslage

Patch 536 hat den Partial-Env-Fall fuer `preview_page` bereits fachlich korrekt als `preview_env_missing` klassifiziert und den browser-facing HTML-Fehlerpfad erhalten. Im Review blieb aber ein kleiner echter Cleanup-Restpunkt: `fetchPreviewRecord()` legte `withTimeout(8000)` schon vor dem `supabaseHeaders()`-Check an. Wenn `PREVIEW_SUPABASE_URL` vorhanden war, aber `PREVIEW_SERVICE_ROLE_KEY` fehlte, kehrte der Lookup frueh zurueck und liess den unnoetigen Pending-Timer ausserhalb des normalen Fetch-Cleanup-Pfads weiterlaufen.

## Umsetzung

- `supabase/functions/preview_page/index.ts`
  - zieht den `supabaseHeaders()`-Guard vor die `withTimeout(8000)`-Allokation in `fetchPreviewRecord()`.
  - behaelt das bestehende Verhalten fuer den Partial-Env-Fall (`preview_env_missing`) unveraendert bei.
  - laesst den browser-facing HTML-Fehlerpfad in `preview_page` unveraendert.

- `__tests__/previewEdgeErrorContract.test.ts`
  - ergaenzt einen fokussierten Strukturvertragstest, der absichert, dass `fetchPreviewRecord()` den Header-/Env-Guard vor dem Timeout anlegt und damit kein unnoetiger Timer im Partial-Env-Pfad entstehen kann.

## Warum das sicher ist

- Kein Contract-Umbau an `save_preview` oder am Preview-HTML-Pfad.
- Keine Aenderung an Statuscode-/Header-/HTML-Marker-Semantik.
- Nur die Reihenfolge im Lookup wird minimal korrigiert, damit der fruehe `preview_env_missing`-Return keinen offenen Timer mehr hinterlaesst.

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand previewEdgeErrorContract.test.ts`
