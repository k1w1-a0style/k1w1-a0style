# Patch 572 – Kleiner Rehydration-/Creation-Helper-Extract aus `ProjectContext`

Datum: 2026-03-28  
Branch: `codex`

## Ziel

Kleiner, risikoarmer Entflechtungsschritt im Regressions-Hotspot `contexts/ProjectContext.tsx`, ohne Architekturumbau:

- wiederholte Inline-Normalisierung fuer geladenes Projektmaterial entkoppeln
- wiederholten Inline-Aufbau neuer Projektobjekte auf einen kleinen pure Helper ziehen
- `ProjectContext` als Orchestrator unveraendert lassen

## Umgesetzte Aenderungen

### 1) Neuer lokaler pure Helper `contexts/projectContextHelpers.ts`

Neu eingefuehrt wurden zwei kleine pure Funktionen:

- `normalizeLoadedProjectData(...)`
  - normalisiert geladene Projektdaten fuer Rehydration
  - faellt bei fehlenden Feldern auf bestehende Defaults zurueck (`files`, `chatHistory`, `preferredPreviewMode`)

- `buildProjectForCreation(...)`
  - baut ein neues Projektobjekt fuer Create-/Fallback-Pfade
  - setzt die bestehenden Standardwerte (Name/Slug/Preview-Mode, leere Chat-History, Zeitstempel)
  - optional mit `templateId`/`effectiveTemplateId`

### 2) `ProjectContext.tsx` nutzt Helper statt Inline-Duplikation

In `ProjectContext` wurden nur die klarsten Dopplungen ersetzt:

- Rehydration beim App-Start:
  - statt direkter Inline-Mutationen (`if (!savedProject.files) ...`) jetzt `normalizeLoadedProjectData(savedProject)`
- Neues Projekt im Fallback-Pfad:
  - statt Inline-Objektaufbau jetzt `buildProjectForCreation(...)`
- Neues Projekt in `createNewProject`:
  - gemeinsamer Basisaufbau ebenfalls ueber `buildProjectForCreation(...)`

Bewusst unveraendert:

- Storage-Flow (`loadProjectFromStorage` / `saveProjectToStorage`)
- `lastModified`-Update-Semantik im normalen `updateProject`-Pfad
- Chat-/History-/Meta-/Build-Orchestrierung
- API-Vertrag des Context nach aussen

## Tests / Regressionen

Neu: `__tests__/projectContext.helpers.test.ts`

Abgesichert werden gezielt die extrahierten Pure-Contracts:

1. Rehydration-Normalisierung fuellt fehlende Persistenzfelder wie zuvor auf Defaults
2. bereits persistierte Werte bleiben unveraendert erhalten
3. Create-Helper setzt dieselben Standardfelder wie bisher
4. optionale Template-Metadaten bleiben erhalten

Zusatzcheck: bestehender Regressionstest `__tests__/projectContext.createNewProject.regression.test.tsx` bleibt gruen.

## Checks

Ausgefuehrt:

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/projectContext.helpers.test.ts`
- `npm run test:silent -- --runInBand __tests__/projectContext.createNewProject.regression.test.tsx`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`

## Restpunkte (bewusst unveraendert)

- `contexts/ProjectContext.tsx` bleibt weiterhin ein grosser Knoten fuer mehrere Verantwortungen.
- Dieser Patch entkoppelt nur einen kleinen, klar reviewbaren pure-logic-Block (Rehydration-/Creation-Normalisierung), kein Broad Refactor.
