# Patch 503 — Confirm-/Review-UX fuer KI-Aenderungen diff-orientierter gemacht

## Ziel
Den Confirm-/Review-Schritt fuer KI-Aenderungen vor dem Apply kontrollierbarer machen, indem Nutzer nicht nur eine Text-Summary, sondern kompakte dateibezogene Vorschauen fuer neue und geaenderte Dateien sehen.

## Umsetzung
- `components/chat/ConfirmChangesModal.tsx`
  - Bestehende `changePreviews` werden jetzt als dateibezogene Review-Karten fuer neue, geaenderte und uebersprungene Dateien genutzt.
  - Neue Dateien zeigen eine kleine Inhaltsvorschau.
  - Geaenderte Dateien zeigen einen kompakten Delta-Ausschnitt plus kurze Vorher-/Nachher-Snippets.
  - Builder-vs-Validator-Provenance wird ueber `finalFileSource` und `validatorState` als ehrliches advisory Review sichtbar gemacht.
  - Geblockte/uebersprungene Hinweise erscheinen in eigenen kompakten Sections statt nur im langen Summary-Text.
- `styles/chatScreenStyles.ts`
  - Kleine Modal-Styles fuer Provenance-Metadaten und Datei-Statusfarben ergaenzt.
- `__tests__/ConfirmChangesModal.review.test.tsx`
  - Review-Regressions fuer neue Datei-Vorschau, Delta-/Vorher-/Nachher-Ausschnitte, Provenance, sichtbare Skip/Block-Hinweise und unveraenderten Accept/Reject-Flow erweitert.
- `__tests__/changePreview.test.ts`
  - Kleine Helper-Regression fuer kompakte Vorschau bei neuen Dateien und Delta-Snippets bei Updates ergaenzt.

## Guard-/Scope-Status
- Keine neue Apply-Architektur.
- Keine neue Diff-Engine.
- Keine Dependency-Updates.
- Confirm-/Review-UX bleibt auf vorhandenen `changePreviews` und Metadaten aufgebaut.

## Checks
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
