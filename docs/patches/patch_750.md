# Patch 750 — Preview-Contract/Gate/Secret-Truth Sync

## Ziel

Gezielter Fixlauf fuer reale Problemstellen ohne Architekturumbau:
- Preview-Contract-Drift beim Invalid-Secret-Code schliessen
- Release-Gate wieder belastbar machen
- QR-Secret-Leak zu externen Diensten entfernen
- Doku-/Contract-Checks auf truthful Aussagen nachziehen

## Umsetzung

1. `supabase/functions/preview_page/index.ts`
   - Invalid-Secret-Code von `preview_invalid_payload` auf den echten Contract `preview_payload_invalid` korrigiert.
2. Preview-UI/Helper
   - externer QR-Service-Pfad entfernt (kein `api.qrserver.com` mehr), QR-Aktionen fail-safe deaktiviert.
   - Secret-URL wird in der Preview-Karte nur noch maskiert dargestellt.
3. Contract-/Gate-Tests
   - `__tests__/previewEdgeErrorContract.test.ts` prueft explizit den exakten Invalid-Code und blockt den Legacy-Drift.
   - `__tests__/releaseReadiness.contracts.test.ts` sichert `OK_WITH_SKIPS` vs `OK_FULL`-Ausgabevertrag.
   - `__tests__/previewHelpers.test.ts` auf QR-freien Kanaltext synchronisiert.
4. Docs-/Checker-Truth
   - `scripts/check_docs_contracts.js` von reiner Marker-Pruefung auf scope-/truth-naehere Muster gehaertet.
   - Review/Fresh-Checkout/Coverage/Checklog auf den realen Gate-Status (`OK_WITH_SKIPS` ohne Live-Env) synchronisiert.

## Tests / Checks

- `npm run typecheck:edge`
- `npm run test:silent -- --runInBand __tests__/previewEdgeErrorContract.test.ts __tests__/previewHelpers.test.ts __tests__/releaseReadiness.contracts.test.ts`
- `node scripts/check_docs_contracts.js`
- `bash scripts/check_release_readiness.sh`

## Nicht-Ziele

- kein Hook-/Context-Refactoring
- keine Architektur-Migration
- kein Rework des Preview-Secret-Modells ueber den sicheren Minimalfix hinaus
