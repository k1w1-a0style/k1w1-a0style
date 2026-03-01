# Patch 331: BuildHistorySection Type-Hardening + Audit-Check

## Ziel
Einen weiteren Punkt der TS-Hygiene/Fix-Liste abarbeiten: `any`-Nutzung in der Build-Historie reduzieren und die Komponente strikter am Shared-Type `BuildHistoryEntry` ausrichten.

## Änderungen

### 1) `BuildHistorySection` typisiert (statt `any[]`)
- Datei: `screens/EnhancedBuildScreen/components/BuildHistorySection.tsx`
- Neue lokale Props-/Hilfstypen ergänzt:
  - `HistoryFilter`
  - `BuildHistoryStats`
  - `BuildHistorySectionProps`
- `history` jetzt `BuildHistoryEntry[]` statt `any[]`.

### 2) Zugriff auf History-Elemente ohne `as any`
- Grouping-Logik liest `h.buildProfile` direkt typisiert.
- CSV-Export nutzt Header-Liste als `satisfies Array<keyof BuildHistoryEntry>` für key-sicheren Zugriff.
- `history.map((h: any) => ...)` auf typisiertes `history.map((h) => ...)` umgestellt.

### 3) Kleine UI-Konsistenz
- Filter-Button-Block im Return sauber eingerückt (keine Funktionsänderung).

## Warum sicher
- Keine API-/Business-Logik geändert.
- Nur Typing-Härtung + kleine Struktur/Konsistenz im JSX.
- Vollständige Standard-Checks grün.

## Validierung
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
