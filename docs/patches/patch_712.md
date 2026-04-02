# Patch 712 - P1 Path-Chips im Datei-Review

## Kontext

Der geparkte P1-Punkt "Path-Chips in der Planung" sollte den Unterschied zwischen automatisch uebernehmbaren und manuell zu pruefenden Pfaden klarer machen.

## Aenderungen

1. `ConfirmChangesModal` zeigt jetzt pro Review-Karte einen Path-Chip:
   - `wird geändert` fuer `new`/`updated`
   - `manuell nötig` fuer `skipped`
2. Neue Styles in `styles/chatScreenStyles.ts` fuer die Chip-Visualisierung (Change vs. Manual).
3. Regressionen in `__tests__/ConfirmChangesModal.review.test.tsx` erweitert:
   - Chip sichtbar bei normalen Datei-Änderungen
   - Manual-Chip sichtbar bei übersprungenen/guarded Pfaden
4. `docs/TODO.md` markiert den P1-Path-Chip-Punkt als erledigt (Patch 712).

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/ConfirmChangesModal.review.test.tsx __tests__/chatComposer.guardBadge.test.tsx`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
