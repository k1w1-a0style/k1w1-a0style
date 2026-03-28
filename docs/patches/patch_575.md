# Patch 575 – Kleiner Notice-Helper-Extract aus `useCiLiteWorkflow`

Datum: 2026-03-28  
Branch: `codex`

## Ziel

Kleiner, reviewbarer Entflechtungsschritt im Hook-Hotspot `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`, ohne Flow-Umbau:

- einen klaren pure-logic-Block fuer Artifact-/Notice-Textbildung extrahieren
- doppelte Inline-Sanitizing-/Fallback-Muster lokal zentralisieren
- Polling-/Dispatch-/Timer-/Cancel-Semantik bewusst unveraendert lassen

## Umgesetzte Aenderungen

### 1) Neuer lokaler Pure-Helper fuer Artifact-Notices

Neue Datei:

- `components/CiLiteHeaderButton/hooks/ciLiteWorkflowNoticeHelpers.ts`

Enthaelt:

- `sanitizeArtifactDetail(...)`
  - whitespace-normalisierung auf eine Zeile
  - Redaction fuer `github_pat_*`, `gh[pousr]_*`, `x-k1w1-admin-key`, `authorization: bearer ...`
  - Truncation auf den bisherigen Detail-Contract (`180` + Ellipsis)

- `getArtifactUiMessage(...)`
  - trennt weiterhin erfolgreiche-completed-Run-Hauptmeldung vs. generische Artifact-Hauptmeldung
  - fuegt Detailhinweis (`Detail: ...`) unveraendert nur bei vorhandenem Fehlertext an

### 2) Hook bleibt Orchestrator

`components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts` wurde nur minimal angepasst:

- inline `sanitizeArtifactDetail(...)` + `getArtifactUiMessage(...)` entfernt
- stattdessen Import aus dem neuen lokalen Helper
- Async-/Polling-/Timer-/Cancel-/Chain-Run-Flow bleibt unveraendert

## Tests / Regressionen

Neu:

- `__tests__/ciLiteWorkflowNoticeHelpers.test.ts`

Abgesichert werden gezielt:

1. leerer Fehlertext -> keine Notice
2. completed+success -> spezifische Hauptmeldung + Detailsuffix
3. non-success/non-completed -> generische Hauptmeldung + Detailsuffix
4. Secret-Redaction + Truncation-Vertrag im Detailtext

Bestehend weiter gruen:

- `__tests__/useCiLiteWorkflow.behavior.test.tsx` (inkl. Artifact-Notice-/Redaction-/One-attempt-Semantik)

## Checks

Ausgefuehrt:

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/ciLiteWorkflowNoticeHelpers.test.ts __tests__/useCiLiteWorkflow.behavior.test.tsx`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`

## Restpunkte (bewusst unveraendert)

- `useCiLiteWorkflow.ts` bleibt weiterhin ein grosser Mischblock fuer Polling/Status/Artifact/Timer-Orchestrierung.
- Dieser Patch extrahiert bewusst nur den kleinen Notice-/Sanitizing-Teil und fuehrt keine neue Architektur ein.
