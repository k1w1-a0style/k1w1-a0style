# Patch 711 - Guard-Hint-Erkennung zentralisiert

## Kontext

Nach dem Chat-Guard-UX-Nachzug (Patch 709/710) war die Marker-Logik fuer Guard-/Ownership-Hinweise an mehreren Stellen dupliziert (`ChatScreen` und `ConfirmChangesModal`). Das erhoeht Drift-Risiko bei spaeteren Marker-Anpassungen.

## Aenderungen

1. Neues Shared-Helper-Modul `lib/guardHints.ts`:
   - `hasGuardHint(...)` fuer boolesche Guard-Erkennung
   - `extractGuardHints(...)` fuer gefilterte Guard-Hinweislisten
2. `screens/ChatScreen/index.tsx` nutzt jetzt `hasGuardHint(...)` statt lokaler Regex.
3. `components/chat/ConfirmChangesModal.tsx` nutzt jetzt `extractGuardHints(...)` statt lokaler Markerliste/Funktion.
4. Neue Regression `__tests__/guardHints.test.ts` fuer case-insensitive Erkennung, Non-Guard-Filterung und Extraktion.

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/guardHints.test.ts __tests__/chatComposer.guardBadge.test.tsx __tests__/ConfirmChangesModal.review.test.tsx`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
