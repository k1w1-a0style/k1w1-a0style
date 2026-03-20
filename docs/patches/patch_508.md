# Patch 508: LocalRemoteDiffSection-Truthfulness-Test gegen Teardown-Races stabilisiert

## Ziel

Den bekannten Flake in `__tests__/localRemoteDiffSection.truthfulness.test.tsx` klein und ursachenbezogen beruhigen, ohne die bestehende Truthfulness-Semantik aufzuweichen oder den Scope auf andere Repo-Themen auszuweiten.

## Beobachtung bei der Reproduktion

- Der fokussierte Test lief isoliert mehrfach gruen.
- Die Full-Suite lief in diesem Stand ebenfalls gruen.
- Der auffaellige Risikopfad blieb aber im Code sichtbar: laufende `load()`-/`openPreview()`-Promises konnten nach einem Teardown/Unmount weiterhin in denselben Komponenten-State committen, solange `repo/branch` bzw. `truthKey` formal noch passten.

## Identifizierte Ursache

Kein fachlicher Diff-Fehler, sondern ein **stale async update nach Unmount/Teardown**:

- `genRef` und `previewReqRef` schuetzten bereits gegen Repo-/Branch-Wechsel.
- Beim echten Unmount gab es jedoch keinen zusaetzlichen Guard.
- Dadurch konnten verspaetete Promise-Ruecklaeufer theoretisch noch `setState(...)` ausloesen, obwohl der Test-/Render-Kontext bereits entfernt war.
- Genau so ein Muster passt zum beschriebenen Timeout-/Teardown-/Open-Handle-artigen CI-Verhalten.

## Umsetzung

### Produktcode

- `screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx`
  - fuehrt einen kleinen `mountedRef`-Guard ein.
  - invalidiert laufende Async-Generationen explizit im `useEffect`-Cleanup beim Unmount.
  - commitet stateaendernde Async-Folgen aus `load()` nur noch, wenn die Komponente noch gemountet ist.
  - behaelt die bestehende Repo-/Branch-/Truthfulness-Logik ansonsten unveraendert bei.

### Testcode

- `__tests__/localRemoteDiffSection.truthfulness.test.tsx`
  - ergaenzt eine Regression fuer spaete Diff-Loads nach `unmount()`.
  - bestaetigt damit explizit, dass ein verspaeteter Resolve nach Teardown keinen alten UI-Commit mehr ausloest.

## Warum Test-only nicht gereicht hat

Ein reines `waitFor`-/`flushMicrotasks`-Tuning haette das Kernproblem nur kaschiert: die eigentliche Async-Quelle lag in der Komponentenlogik selbst, weil Unmount kein eigener Invalidation-Guard war. Deshalb war hier ein kleiner produktiver Cleanup-Guard gerechtfertigt.

## Semantik bleibt bewusst gleich

- stale Loads aus altem Kontext duerfen weiterhin nicht committen
- Preview-/Cache-Wahrheit darf nicht in neue Kontexte leaken
- Same-Context-Regressionsfaelle bleiben unveraendert gruen
- keine globale Timeout-Erhoehung

## Checks

- `npm run test:silent -- --runInBand __tests__/localRemoteDiffSection.truthfulness.test.tsx --detectOpenHandles`
- `npm run typecheck`
- `npm run lint:ci`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run test:silent`
