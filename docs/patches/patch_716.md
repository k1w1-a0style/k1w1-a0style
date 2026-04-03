# Patch 716 - Guard-Audit-Dedupe im Confirm-Modal

## Kontext

Nach Einfuehrung der lokalen Guard-Audit-Telemetrie (Patch 715) soll das Modal bei stabiler sichtbarer Guard-Lage nicht mehrfach dasselbe Event protokollieren.

## Aenderungen

1. `ConfirmChangesModal` fuehrt eine per-Dialog-Signatur (`guardWarnings.join("||")`) ein.
2. Guard-Audit wird nur geschrieben, wenn sich die Signatur in derselben offenen Modal-Session aendert.
3. Beim Schliessen des Modals wird die Signatur zurueckgesetzt (Re-Open darf erneut erfassen).
4. Neue Regression `__tests__/confirmChangesModal.guardAuditFlow.test.tsx` sichert:
   - kein Doppel-Record bei unveraendertem Re-Render
   - erneute Erfassung nach Close->Reopen

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/confirmChangesModal.guardAuditFlow.test.tsx __tests__/ConfirmChangesModal.review.test.tsx`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
