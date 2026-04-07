# Patch 752 - Preview-Expiry-Cleanup Hash/Legacy Fix

## Ziel
Offenen Folgefehler aus PR #574 minimal-invasiv beheben: Expiry-Cleanup muss sowohl gehashte als auch Legacy-raw Preview-Secrets loeschen koennen.

## Befund
Nach Patch 751 speichert `save_preview` neue Rows mit gehashtem `secret`.
`preview_page`-Lookup war bereits hash-first + raw-fallback kompatibel.
Der Expiry-Delete lief jedoch noch mit raw secret (`secret=eq.<raw>`), wodurch gehashte Rows beim Expiry-Cleanup nicht geloescht wurden.

## Umsetzung
- Neuer gemeinsamer Helper: `buildPreviewSecretCandidates(secret)` in `supabase/functions/preview_page/helpers.ts`.
- `fetchPreviewRecord(...)` nutzt die Candidate-Liste (hash-first, dann legacy raw).
- `deletePreviewRecord(...)` nutzt dieselbe Candidate-Liste und versucht Delete fuer beide Kandidaten.

Damit gilt:
- neue gehashte Rows: loeschbar bei Expiry
- alte raw Rows: weiterhin loeschbar

## Tests
- `__tests__/previewEdgeErrorContract.test.ts` erweitert:
  - Candidate-Order (hash-first + raw)
  - Expiry-Delete-Pfad nutzt Candidate-Loop und `secret=eq.${encodeURIComponent(candidate)}`
  - Lookup bleibt auf demselben Candidate-Mechanismus

## Validation
- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent -- --runInBand __tests__/previewEdgeErrorContract.test.ts __tests__/releaseReadiness.execution.contract.test.ts`
