# Patch 316: Preview file payload stats in Statusbar

## Ziel

Einen weiteren offenen PR-9 Punkt aus der Fix-Liste abschließen: In `PreviewScreen` sichtbar machen, wie viele Dateien in die Preview gehen, wie groß der Payload ist und wie viele Dateien übersprungen wurden.

## Änderung

- `hooks/usePreview.ts`
  - `PreviewState` um `skippedCount` erweitert.
  - Dateifilterung zählt jetzt ausgelassene Dateien explizit (ungültiger Pfad, nicht erlaubte Endung, Sanitization-Fail, Größenlimit).
  - `totalSize` wird aus derselben Sammelphase geliefert (kein doppeltes Reduce).
- `screens/PreviewScreen/components/PreviewStatusBar.tsx`
  - Neue Status-Anzeige: `fileCount`, `totalSize` (KB), optional `skippedCount`.
- `screens/PreviewScreen/PreviewScreen.tsx`
  - Übergibt die neuen Stats aus `state` an die Statusbar.
- `screens/PreviewScreen/PreviewScreen.styles.ts`
  - Kleiner Style für die neue Stats-Zeile.
- `docs/PROJECT_TODO.md`
  - Offenen PR-9 Punkt als erledigt markiert (`patch 316`).

## Checks

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
