# Patch 307 — Lint-Warnungen entfernen + README/Patch-Stand synchronisieren

## Ziel
Kleiner Stabilitäts-/Dokumentations-Patch ohne Verhaltensänderung:
- verbleibende `expo lint`-Warnings entfernen
- sichtbaren Patch-Stand in der README auf aktuellen Stand bringen

## Änderungen

### 1) Lint-Warnungen entfernt
- `components/diagnostics/ModeSelector.tsx`
  - `global as any` auf typisierte `globalThis`-Abfrage umgestellt
  - unnötige `eslint-disable`-Direktive entfernt
- `components/diagnostics/SegmentedTabs.tsx`
  - `global as any` auf typisierte `globalThis`-Abfrage umgestellt
  - unnötige `eslint-disable`-Direktive entfernt

### 2) Docs-Drift korrigiert
- `README.md`
  - „Letzter Stand im Repo“ auf Patch 307 aktualisiert

## Checks
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
npm run lint
```

Alle Checks sind in dieser Session grün.
