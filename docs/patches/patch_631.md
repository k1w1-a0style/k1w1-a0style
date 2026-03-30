# Patch 631 — `as any`-Abbau (Durchlauf 5, UI-/Style-/Interop-Reste)

## Ziel
Ein weiterer kleiner Durchlauf fuer verbleibende lokale `as any`-Reste in UI-/Style-/Interop-Glue ohne Refactor.

## Umgesetzt
1. Glow-Style-Casts entfernt
   - `components/ChatHeaderActions.tsx`
   - `components/CustomDrawer/PulseDot.tsx`
   - `components/CiLiteHeaderButton/styles.ts`
   - `components/CiLiteHeaderButton/components/StatusIndicators.tsx`

2. Icon-/UI-Casts entfernt
   - `screens/EnhancedBuildScreen/index.tsx` (Checklist-Chip-Icons)

3. Interop-/Utility-Casts weiter reduziert
   - `screens/CodeScreen/components/WebCodeEditor.tsx` (`postMessage`)
   - `screens/EnhancedBuildScreen/components/ChecklistSection.tsx` (`FIX_ORDER.indexOf`)
   - `screens/GitHubReposScreen/hooks/templateFiles.ts` (Template-JSON als `unknown`)

## Inventar
- Codefokussierter Scan (ohne `docs/**` und `README.md`):
  - Vorher: 187
  - Nachher: 178
  - Netto: **-9 `as any`**

## Verifikation
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `npm run test:silent -- --runInBand k1w1Handler.providers.invariants.test.ts`
- `git diff --check`
