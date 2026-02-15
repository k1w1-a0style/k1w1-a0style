# Patch 137

Datum: **2026-02-15**

## Kontext
Bei `npm run test:silent` (Jest parallel/worker mode) erschien gelegentlich die Warnung:

- `A worker process has failed to exit gracefully ... (tests leaking / active timers)`

Die Test-Suites waren zwar **grün**, aber die Warnung ist störend und kann in CI/Local Runs für Verunsicherung sorgen.

## Änderungen
### 1) Globales Test-Teardown (Jest Worker-Leaks verhindern)
- `jest.setup.js` ergänzt um ein globales Cleanup nach jedem Test:
  - `cleanup()` (Testing Library)
  - `jest.clearAllMocks()`
  - `jest.clearAllTimers()`
  - `jest.useRealTimers()`
- Zusätzlich ein `afterAll()` um Rest-Timer sicher zu räumen.

## Betroffene Dateien
- `jest.setup.js`

## Verifikation
Lokal ausgeführt (CI-äquivalent):
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent` ✅
