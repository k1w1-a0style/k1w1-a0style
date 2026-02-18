# Patch 34 — CodeScreen follow-ups (Quality + small UX safety)

## Ziele
- Kleine, sichere Quality-Fixes am CodeScreen ohne Layout-/Icon-Umbruch.
- TODO auf aktuellen Stand bringen.

## Änderungen
### CodeScreen
- **Duplicate**: `handleDuplicateFile` erzeugt jetzt collision-safe Namen (`_copy`, `_copy2`, …) statt blind zu überschreiben.
- **Create File**: `.tsx` wird nur noch automatisch angehängt, wenn es wirklich Sinn macht (kein `.env`, `Dockerfile`, `Makefile`, `.gitignore` usw.).
- **Clipboard**: Copy nutzt `Clipboard.setStringAsync(...).then/.catch` (mit Error-Toast) statt fire-and-forget.
- **SyntaxErrorBar**: stabiler React `key` (nicht mehr Array-Index).

### Docs
- `docs/TODO.md` aktualisiert (CodeScreen Status + offene Punkte).

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

