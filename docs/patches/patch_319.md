# Patch 319: Preview skippedCount korrekt für invalide Files

## Ziel

Gemeldeten Folgefehler nach Patch 318 kritisch beheben: `skippedCount` in der Preview-Statusbar war ungenau, wenn `projectData.files` invalide Einträge enthielt.

## Änderungen

- `hooks/usePreview.ts`
  - Vor dem Type-Guard-Filter wird jetzt eine `sourceList` geführt.
  - `skippedCount` startet mit `sourceList.length - list.length`, damit auch durch den Type-Guard verworfene (malformed) Einträge korrekt als „übersprungen“ zählen.
  - Bestehende Limits/Filterlogik bleibt unverändert.

## Ergebnis / Einordnung

- Preview-Status (`skippedCount`) bildet jetzt alle tatsächlich nicht verwendeten Dateien ab, inklusive invalider Datensätze.
- Keine Verhaltensänderung bei validen Files, nur präzisere Telemetrie/Feedback.

## Checks

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
