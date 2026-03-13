# Patch 422 — E2E-Traceability-Fix für Build-History-Updates

## Ziel
Restdrift in der E2E-Kette schließen, bei der `currentBuild`-Polling-Updates theoretisch Werte (Repo/Branch/Profil) aus einem später geänderten UI-Zustand übernehmen könnten, statt der beim Start tatsächlich verwendeten Build-Auswahl.

## Minimaler Fix
- `contexts/ProjectContext.tsx`
  - Neue kleine Resolver-Funktion `resolveHistoryBuildSelection(...)` eingeführt.
  - Snapshot der effektiven Build-Auswahl (Repo/Branch/Profil) beim Build-Start in einem Ref gehalten.
  - History-Updates während Polling nutzen diesen Snapshot job-gebunden (`jobId`-Match), sonst Fallback auf `currentBuild`.

## Warum nötig
So bleibt die operative Wahrheit für einen gestarteten Build stabil entlang der Strecke:
Auswahl → Start/Dispatch → Polling/Status → History.

## Tests
- `__tests__/projectContext.sotResolvers.test.ts`
  - Neue Tests für `resolveHistoryBuildSelection` (job-passender Snapshot vs. Fallback).
- `__tests__/buildTraceability.transparency.invariants.test.ts`
  - Invariant auf neue History-Selection-Verdrahtung angepasst.
