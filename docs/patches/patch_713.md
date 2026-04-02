# Patch 713 - P1 Structured Follow-up fuer Guarded-Pfade

## Kontext

Nach Path-Chips (Patch 712) blieb der zweite P1-Punkt offen: Bei guarded/manual-only Pfaden sollen sichere Anschlussoptionen direkt im Review sichtbar sein.

## Aenderungen

1. `ConfirmChangesModal` zeigt im Guard-Hinweis jetzt einen strukturierten Safe-Follow-up-Block mit zwei klaren Optionen:
   - **A)** nur unkritische Dateien direkt anwenden + guarded Pfade als manuelle TODO-Liste
   - **B)** sichere Minimal-Variante ohne guarded Pfade erzeugen und guarded Pfade danach einzeln entscheiden
2. `__tests__/ConfirmChangesModal.review.test.tsx` erweitert:
   - Follow-up-Optionen werden bei Guard-Hinweisen angezeigt
   - Follow-up-Optionen werden ohne Guard-Hinweise nicht angezeigt
3. `docs/TODO.md` markiert den zweiten P1-Punkt als erledigt (Patch 713).

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/ConfirmChangesModal.review.test.tsx`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
