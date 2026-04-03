# Patch 714 - P2 Policy-Explain im Guard-Hinweis

## Kontext

Nach P1 (Path-Chips + Structured Follow-up) war der erste P2-Punkt offen: Eine kurze, direkte Erklärung, warum Guard-Regeln greifen und welche Pfadtypen betroffen sind.

## Aenderungen

1. `ConfirmChangesModal` erweitert den Guard-Hinweis um einen umschaltbaren Policy-Explain-Bereich:
   - Toggle: `Warum Guard-Regeln? (kurz erklärt)`
   - Bei Expand: kurze Guard-Begründung + typische Beispiele (Secrets, Baseline-Templates, Deploy/Infra, Owner-Pfade)
2. Beim Schließen des Modals wird der Explain-State zurückgesetzt, damit jeder Review-Durchlauf konsistent startet.
3. `styles/chatScreenStyles.ts` ergänzt um Styles für Toggle und Explain-Card.
4. `__tests__/ConfirmChangesModal.review.test.tsx` erweitert:
   - Toggle sichtbar
   - Expand zeigt Policy-Text
5. `docs/TODO.md` markiert P2 Policy-Explain als erledigt (Patch 714).

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/ConfirmChangesModal.review.test.tsx`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
