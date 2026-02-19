# Patch 198 — Build types import cleanup (PR-8 Stage 3)

## Ziel
Reduziert Import-Drift und Re-Export-Kaskaden rund um Build-Typen.

## Änderungen
- `BuildStatus` wird in UI/Utils künftig direkt aus `shared/types/build` importiert.
- `lib/buildStatusMapper` bleibt für **Mapping-Logik** (`mapBuildStatus`) bestehen.

## Betroffene Dateien
- `utils/buildScreenUtils.ts`
- `contexts/ProjectContext.tsx`
- `components/build/BuildTimelineCard.tsx`
- `screens/EnhancedBuildScreen/*` (Typ-Imports)

## Erwartung
- Keine Behavior-Änderung.
- Typecheck/Lint/Tests bleiben grün.
