# Patch 60 Notes

Stand: 2026-02-11

## Fix
- PreviewFullscreen: TypeScript-Fix für Icon-Farbe (`theme.palette.text.primary` statt Objekt).
- PreviewFullscreen: falscher Style-Key `topTitleContainer` → `titleContainer`.

## Verhalten / UI
- Keine optische Änderung beabsichtigt (Layout bleibt gleich).
- Nur Build-Stabilität: `npm run typecheck` und Jest laufen wieder grün.
