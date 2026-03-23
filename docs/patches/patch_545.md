# Patch 545

## Titel
Repo-weite Testhygiene fuer saubere Timer-, Mock- und Netzwerk-Isolation nachgeschaerft.

## Kontext
- Die Suite hatte bereits globale Cleanup-Bausteine, aber einige Tests verliessen sich noch implizit auf Datei- oder Prozesszustand.
- Besonders riskant fuer parallele Ausfuehrung waren: global ueberschriebene `fetch`-Mocks ohne per-Test-Reinitialisierung, lokale Fake-Timer ohne explizite Rueckgabe auf Real-Timer und ein Test mit prozessweitem Env-Mutationsrest.
- Ziel war Stabilisierung der Testumgebung, nicht Produktlogik-Aenderung.

## Was wurde geaendert?
- `jest.setup.js` initialisiert blockierte Netzwerk-Globals (`fetch`, `XMLHttpRequest`, `WebSocket`) jetzt vor **jedem** Test neu und raeumt nach jedem Test Timer und DOM konsistent auf.
- Die betroffenen Netzwerk-Helper-Tests (`lib/__tests__/fetchWithTimeout.test.ts`, `lib/__tests__/retryWithBackoff.test.ts`) setzen ihr `global.fetch` jetzt deterministisch im `beforeEach(...)` statt implizit nur einmal auf Dateiebene.
- `__tests__/aiContext.persistence.test.tsx` und `__tests__/useChatAIFlow.timeoutAbort.regression.test.ts` geben lokale Fake-Timer explizit in `afterEach(...)` zurueck, damit kein Timer-State zwischen Faellen auslaeuft.
- `__tests__/usePreview.serverContract.test.tsx` setzt `EXPO_PUBLIC_SUPABASE_URL` nach jedem Test wieder auf den urspruenglichen Prozesswert zurueck.
- Keine Produktlogik, keine Timeouts, keine Assertions und keine Parallelitaet wurden abgeschwaecht.

## Validierung
- `npx jest --silent __tests__/aiContext.persistence.test.tsx __tests__/useChatAIFlow.timeoutAbort.regression.test.ts __tests__/usePreview.serverContract.test.tsx lib/__tests__/fetchWithTimeout.test.ts lib/__tests__/retryWithBackoff.test.ts __tests__/useCiLiteWorkflow.behavior.test.tsx __tests__/useGitHubActionsLogs.contract.test.tsx __tests__/buildPollingService.test.ts` ✅
- `npm run test:silent` (Run 1) ✅
- `npm run test:silent` (Run 2) ✅
- `npm run test:silent` (Run 3) ✅
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `git diff --check` ✅
