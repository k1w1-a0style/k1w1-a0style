# Patch 544

## Titel
LocalRemoteDiffSection-Truthfulness-Test fuer Default-Parallel-Jest deterministisch gemacht.

## Root Cause
- Die Flake lag im Test `__tests__/localRemoteDiffSection.truthfulness.test.tsx`, nicht in der Produktlogik.
- Nach dem ersten Refresh lief noch ein alter Diff-Load fuer `repo-a`. Der Test wechselte direkt auf `repo-b`/`develop` und drueckte den zweiten Refresh sofort.
- Der Component-Reset (`loading=false`, `items=[]`, `selected={}`) passiert aber effect-getrieben nach dem Rerender. Unter paralleler Last konnte der zweite Button-Press daher noch gegen den alten `loading=true`-Zustand laufen und wurde als disabled no-op verworfen.

## Was wurde geaendert?
- Neuer kleiner Test-Helper `waitForContextReset(...)`, der nach einem Repo-/Branch-Wechsel explizit auf `Push (0)` als sichtbares Reset-Signal wartet, bevor der naechste Refresh ausgelost wird.
- Die beiden repo-change Tests warten jetzt deterministisch auf diesen Reset statt implizit auf scheduler timing zu vertrauen.
- Ein `afterEach(...)` fuehrt `cleanup()`, `jest.useRealTimers()` und `jest.clearAllMocks()` aus, damit kein Mock-/Timer-/Render-State zwischen den Testfaellen auslaeuft.
- Keine Timeouts wurden erhoeht, keine Assertions abgeschwaecht, kein `runInBand` erzwungen.

## Validierung
- `for i in 1 2 3 4 5; do npx jest --silent __tests__/localRemoteDiffSection.truthfulness.test.tsx || exit 1; done` ✅
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent` ✅
- `git diff --check` ✅
