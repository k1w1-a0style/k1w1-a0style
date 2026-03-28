# Patch 571 – Kleiner Extract fuer Step-Plan-/Step-Status-Logik im Diagnostic Fix Runner

Datum: 2026-03-28  
Branch: `codex`

## Ziel

Kleiner, sicherer Entflechtungsschritt im Hook-Hotspot `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts`, ohne Flow-/Semantikwechsel:

- Step-Plan-Erzeugung fuer Issue/Single/Batch-Fix entkoppeln
- wiederholte Inline-Step-Status-Updates (`pending/running/done/failed`) auf einen kleinen pure Helper ziehen

## Umgesetzte Aenderungen

### 1) Neuer lokaler Helper `fixRunnerHelpers.ts`

Neu: `screens/DiagnosticScreen/hooks/fixRunnerHelpers.ts`

Enthaelt bewusst kleine pure Funktionen ohne React-Abhaengigkeit:

- `buildIssueFixSteps(...)`
- `buildSingleFixSteps(...)`
- `buildBatchFixSteps(...)`
- `setStepStatusAtIndex(...)`

Damit liegt die Step-Plan-/Step-Mapping-Logik gebuendelt und testbar ausserhalb des Hooks.

### 2) Hook nur als Orchestrator belassen

`useDiagnosticFixRunner.ts` nutzt diese Helper jetzt fuer die klarsten Dopplungen:

- Issue-Fix-Step-Plan (apply/dispatch/sync/rerun)
- Single-Fix-Step-Plan (apply/sync/rerun)
- Batch-Fix-Step-Plan (apply/sync pro deduped fix + optional rerun)
- Status-Updates je Step via `setStepStatusAtIndex(...)` statt mehrfacher inline `map(...)`-Bloecke

Bewusst unveraendert:

- Statuswerte (`patch_applied`, `pending_recheck`, `failed`, `blocked`, ...)
- Toast-/Detailtexte
- Modal-Reihenfolge und Cursor-Semantik
- Apply/Sync/Rerun-Orchestrierung

## Tests / Regressionen

Neu: `__tests__/fixRunnerHelpers.test.ts`

Gezielte Vertragsabsicherung fuer den Extract:

1. Issue-Step-Plan bleibt semantisch gleich (Reihenfolge/Keys/Titel/`pending`)
2. Single-Step-Plan bleibt semantisch gleich
3. Batch-Step-Plan expandiert weiter identisch (`apply:*`, optional `sync:*`, optional `rerun`)
4. `setStepStatusAtIndex(...)` aendert nur den adressierten Step

Zusatzcheck: bestehender Hook-Semantiktest `__tests__/useDiagnosticFixRunner.fixSemantics.test.tsx` weiterhin gruen.

## Checks

Ausgefuehrt:

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/fixRunnerHelpers.test.ts __tests__/useDiagnosticFixRunner.fixSemantics.test.tsx`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`

## Restpunkte (bewusst unveraendert)

- `useDiagnosticFixRunner.ts` bleibt weiterhin ein grosser Hook mit mehreren Verantwortungen.
- Dieser Patch extrahiert nur einen klaren kleinen Block (Step-Plan + Step-Status-Mapping), kein Broad Refactor.
