# Patch 283: Apply full refactoring bundle (modules + extracted styles) + fix FileActionsModal theme import

## Was ist neu
- **Full refactoring bundle** applied (große Dateien modularisiert, Styles/Helpers/Types extrahiert, Wrapper-Re-exports bleiben bestehen).
- **Fix:** `components/FileActionsModal/index.tsx` importierte `theme` aus `../theme` (nicht existent) → korrekt `../../theme`.
- **Packaging-Fix:** keine stray Verzeichnisse im Patch (insb. kein `{components`-Artefakt).

## Dateien (Auszug)
- `components/**` (CiLiteHeaderButton modularisiert, Styles ausgelagert, u.a.)
- `screens/**` (mehrere Screens modularisiert + `.styles.ts` Files)
- `hooks/**`, `contexts/**`, `utils/**`, `infra/**` (Helper/Types Extraktionen)
- `components/FileActionsModal/index.tsx` (theme import fix)

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Warum
Lesbarkeit + Wartbarkeit hoch, Risiko gering: bestehende Importpfade bleiben über Re-export Wrapper stabil.
