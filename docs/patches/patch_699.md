# Patch 699 - Diagnostics PatchEngine Safety Guards

Datum: 2026-04-02

## Kontext
Im Deep-Scan wurde als strukturelles Restrisiko markiert, dass `lib/diagnostics/patchEngine.ts` als Core-API bisher ohne eigene Grundsicherungen arbeitet und damit bei zukuenftiger Nutzung ausserhalb des abgesicherten Fix-Runners keine Default-Grenzen erzwingt.

## Befund
- `applyPatch(...)` akzeptierte bislang beliebige Pfadstrings ohne Basisschutz gegen offensichtliche unsichere Pfade.
- Es gab im Core kein defensives Operations-Limit fuer versehentlich zu grosse Patch-Batches.

## Fix
- `applyPatch(...)` fuehrt jetzt vor der Anwendung eine Safety-Pruefung aus.
- Unsichere Pfade werden fail-closed abgelehnt (leer, absolut, Traversal `..`).
- Patch-Batches mit mehr als 200 Gesamtoperationen (`delete` + `upsert` + `jsonMerge`) werden fail-closed abgebrochen.
- Neue fokussierte Regressionen decken Traversal- und Oversize-Abbruchfaelle ab.

## Validierung
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
