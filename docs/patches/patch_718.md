# Patch 718 - Guard-Audit-Signatur normalisiert (case-insensitive)

## Kontext

Patch 717 machte die Dedupe-Signatur bereits order-insensitive. Als Feinschliff wird die Signatur nun auch case-insensitive und begrenzt, damit rein kosmetische Groß-/Kleinschreibung oder Duplikate keine zusaetzlichen Audit-Events erzeugen.

## Aenderungen

1. `createGuardAuditSignature(...)` in `ConfirmChangesModal`:
   - normalisiert auf lowercase
   - dedupliziert Eintraege
   - sortiert stabil
   - begrenzt auf max. 20 Signatur-Eintraege
2. Regression `__tests__/confirmChangesModal.guardAuditFlow.test.tsx` erweitert:
   - gleiche Guard-Hinweise mit anderer Groß-/Kleinschreibung und Duplikat erzeugen weiterhin kein zusaetzliches Audit-Event.

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/confirmChangesModal.guardAuditFlow.test.tsx __tests__/ConfirmChangesModal.review.test.tsx`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
