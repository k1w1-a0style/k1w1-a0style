# Patch 720 - User-Vorschlagsliste in TODO aufgenommen

## Kontext

Auf Wunsch wurden die neuen Produktverbesserungsvorschlaege explizit als offene TODO-Punkte in die kanonische TODO-SoT aufgenommen.

## Aenderungen

1. `docs/TODO.md` erweitert um neuen Abschnitt
   **"Neu aufgenommen: Produktverbesserungen (User-Vorschlaege 2026-04-02)"**
2. Aufgenommen wurden alle angefragten offenen Punkte:
   - robuster Intent-Classifier
   - strukturierte Planner-Slots
   - sichtbares Kontextkürzungs-Badge
   - strukturierte Pre-Flight-Zusammenfassung vor Builder
   - explizites Persistenz-Scope-Label
   - Guard-Policy-Chips vor Vorschlägen
   - lokale Rückfragen-Qualitätsmetriken
   - Großprojekt-/Scout-Modus

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
