# PATCH 41 — CodeScreen save-flow hardening (unsaved changes)

Datum: 2026-02-10

## Ziel
Unsaved-Changes Flow deterministisch machen:
"Speichern" soll nur dann navigieren/schließen, wenn wirklich gespeichert wurde.

## Änderungen
- Promise-basierte Alerts (`alertAsync`) im CodeScreen Hook.
- `saveSelectedFile()` liefert `boolean` (true nur wenn Save wirklich durchgelaufen ist).
- Alle Unsaved-Changes Dialoge warten auf das Save-Ergebnis, bevor navigiert/geschlossen wird.

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
