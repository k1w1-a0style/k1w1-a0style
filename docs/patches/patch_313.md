# Patch 313: PreviewScreen UI split (PR-9 follow-up)

## Ziel
- Den offenen PR-9 Punkt aus `docs/PROJECT_TODO.md` umsetzen: `PreviewScreen` in kleinere UI-Bausteine aufteilen.

## Änderung
- Neue UI-Komponenten unter `screens/PreviewScreen/components/`:
  - `PreviewToolbar.tsx`
  - `PreviewStatusBar.tsx`
  - `DeviceFrame.tsx`
- `screens/PreviewScreen/PreviewScreen.tsx` auf Composition umgestellt (gleiche Logik/Handler, bessere Lesbarkeit).
- `docs/PROJECT_TODO.md` aktualisiert (PR-9 Split-Task als erledigt markiert).

## Risiko
- Niedrig: Refactor ohne beabsichtigte Verhaltensänderung.

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
