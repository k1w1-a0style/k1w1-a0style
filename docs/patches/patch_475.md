# Patch 475

## Titel
Persistenz-/ProjectContext-Restpunkte konservativ gehärtet (Size-Guard + messages-Referenz)

## Kontext
Es blieben zwei produktionsrelevante Restpunkte offen: fehlender klarer Size-/Safety-Guard vor dem Persistieren großer Projektzustände und unnötige `messages`-Array-Neureferenzen im `ProjectContext` bei allgemeinen `projectData`-Updates.

## Änderungen (minimal)

1) Storage-Size-/Safety-Guard für Projektpersistenz
- `infra/storage/persistenceHelpers.ts`
  - Neue konservative Grenzen:
    - `PROJECT_STORAGE_SOFT_LIMIT_BYTES = 1_500_000`
    - `PROJECT_STORAGE_HARD_LIMIT_BYTES = 1_900_000`
  - Neue Helper:
    - `getUtf8ByteSize(...)`
    - `assertProjectStoragePayloadSafe(...)`
- `infra/storage/projectPersistence.ts`
  - `saveProjectToStorage(...)` prüft den serialisierten Payload vor `AsyncStorage.setItem(...)`.
  - Bei Soft-Limit-Nähe: klare Warnung mit Byte-Anzahl.
  - Bei Hard-Limit-Überschreitung: harter, expliziter Fehlerpfad (kein stilles Oversize-Fail).

2) `messages`-Referenz im ProjectContext stabilisiert
- `contexts/ProjectContext.tsx`
  - `contextMessages` via `useMemo(..., [projectData?.chatHistory])` eingeführt.
  - Context-Value nutzt `messages: contextMessages` statt jedes Mal neuem `filter(...)`-Array.
  - Kein Architekturumbau; nur lokale Referenzstabilisierung.

3) Regressionen ergänzt
- `__tests__/projectPersistence.sizeGuard.test.ts`
  - Soft-Limit-Nähe wird erkannt.
  - Hard-Limit führt zu Throw.
  - Oversize-Projekt schlägt in `saveProjectToStorage(...)` hart fehl und schreibt nicht in AsyncStorage.
- `__tests__/projectContext.messagesReference.invariants.test.ts`
  - Invariant auf memoized `contextMessages`-Pfad + Nutzung im Context-Value.

## Verifikation
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Offen
- Keine neue Storage-/Context-Architektur.
- Keine repo-weite Persistenz-Kampagne.
- Nur die direkt bestätigten Restpunkte plus eng benachbarte Guards adressiert.
