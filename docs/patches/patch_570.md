# Patch 570 – Kleine Typ-/Fehlervertrags-Haertung in AppInfo-Hook und CI-Lite-Patch-Hook

Datum: 2026-03-28  
Branch: `codex`

## Ziel

Zwei naechste kleine, mergefreundliche Typ-/Error-Haertungen ohne Flow-Umbau:

1. `screens/AppInfoScreen/hooks/useAppInfoScreen.ts`
2. `components/CiLiteHeaderButton/hooks/useCiLitePatch.ts`

Fokus: riskante `any`-Zugriffe und unsichere Error-/JSON-Pfade reduzieren, bestehende UI-/Fallback-Semantik beibehalten.

## Umgesetzte Aenderungen

### 1) `useAppInfoScreen.ts`

- Entfernt den weichen Root-Cast `projectData as any`.
- Neue kleine lokale Guards/Helper:
  - `isRecord(...)`
  - `getErrorMessage(...)`
  - `isAbortLikeError(...)`
  - `toProjectFiles(...)`
- Datei-/Asset-Zugriffe laufen jetzt ueber `projectFiles` (guarded `ProjectFileLike[]`) statt `find((f: any) => ...)`.
- Catch-Pfade fuer Save/Import/Export/Backup wurden auf `unknown` + `getErrorMessage(...)` umgestellt.
- Abort-Erkennung nutzt keinen unsicheren Direktzugriff mehr auf `error.message`, sondern den guard-basierten Helper.
- Bestehende Alert-/Fallback-Texte und bestehender Flow bleiben unveraendert.

### 2) `useCiLitePatch.ts`

- Neue kleine lokale Error-/Record-Helper:
  - `isRecord(...)`
  - `getErrorMessage(...)`
- Patch-JSON-Parsing nutzt `parsed: unknown` statt `parsed: any`.
- Catch-Pfade fuer Validate/Apply/Sync wurden auf `unknown` + guard-basiertes Message-Mapping umgestellt.
- Fehlermeldungs-/Fallback-Semantik bleibt erhalten:
  - gleiche Parse-Fehlerklasse (`JSON Parse Fehler: ...`)
  - gleiche Alert-/PatchInfo-Pfade.

## Tests / Regressionen

- `__tests__/ciLitePatch.invariants.test.ts` (bestehend): bestehende Invariants fuer Patch-Sync-Typing bleiben intakt.
- `__tests__/patch570.typeContracts.invariants.test.ts` (neu):
  - sichert in `useAppInfoScreen.ts` die neuen Unknown-/Guard-Errorvertraege und den Wegfall von `projectData as any`.
  - sichert in `useCiLitePatch.ts` Unknown-JSON-Parsing (`let parsed: unknown`) und den Wegfall der riskanten `any`-Catch-/Parse-Muster.

## Checks

Ausgefuehrt:

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/ciLitePatch.invariants.test.ts __tests__/patch570.typeContracts.invariants.test.ts`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`

## Restpunkte (bewusst unveraendert)

- Kein Broad Refactor in AppInfo-/CI-Lite-Flow.
- Keine Aenderung der Backup-/Patch-Anwendungssemantik.
- Allgemeine Typ-Schuld ausserhalb dieser zwei Hotspots bleibt offen fuer weitere kleine Patches.
