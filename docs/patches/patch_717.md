# Patch 717 - Guard-Audit-Signatur stabilisiert

## Kontext

Patch 716 dedupliziert Guard-Audit-Events pro sichtbarer Modal-Session. Damit dieselben Hinweise auch bei unterschiedlicher Reihenfolge nicht doppelt gezaehlt werden, wurde die Signatur weiter stabilisiert.

## Aenderungen

1. `ConfirmChangesModal` nutzt nun `createGuardAuditSignature(entries)`:
   - trimmt Eintraege
   - entfernt Duplikate
   - sortiert stabil
   - bildet daraus die Session-Signatur
2. Dedupe ist damit reihenfolge-unabhaengig fuer dieselbe Guard-Hinweis-Menge.
3. `__tests__/confirmChangesModal.guardAuditFlow.test.tsx` erweitert:
   - Re-Render mit identischen Guard-Hinweisen in anderer Reihenfolge triggert **kein** zusaetzliches Audit-Event.

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/confirmChangesModal.guardAuditFlow.test.tsx __tests__/ConfirmChangesModal.review.test.tsx`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
