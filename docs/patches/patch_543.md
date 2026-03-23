# Patch 543

## Titel
Letzten bestaetigten App-Timeout-Restpunkt auf die gemeinsame Helper-Linie gezogen.

## Was wurde geaendert?
- `project/services/buildPollingService.ts` nutzt fuer `check-eas-build` jetzt den bestehenden App-Helper `lib/network/fetchWithTimeout.ts` inkl. gemeinsamer `TimeoutError`-/Abort-Semantik und behuelt die bisherige nutzerseitige Timeout-Meldung ohne lokale Timer-/Abort-Duplikation.
- `__tests__/buildPollingService.test.ts` prueft den Polling-Timeout jetzt ueber einen abort-aware Fetch-Mock gegen den echten gemeinsamen Helper-Vertrag statt gegen die geloeschte lokale Wrapper-Implementierung.
- `supabase/functions/preview_page/helpers.ts` enthaelt keinen toten `withTimeout(...)`-Rest mehr; `preview_page/index.ts` nutzt weiterhin direkt den bestehenden Edge-Helper.
- `screens/EnhancedBuildScreen/hooks/buildScreenHelpers.ts` behaelt den lokalen `Promise.race(...)`-Guard bewusst, weil `getWorkflowRunDetails(...)` / `getWorkflowRunJobs(...)` ihre eigentlichen Netzrequests bereits ueber `fetchGitHub(...)` → `lib/network/fetchWithTimeout.ts` haerten. Der verbleibende Wrapper begrenzt nur die Gesamtwartezeit des Bundles und wirft jetzt denselben `TimeoutError`-Typ statt eines ad-hoc `Error("Timeout")`.

## Repo-weite Suche / Befund
- Kein weiterer nackter Produkt-Fetch im bestaetigten App-Scope gefunden; `buildPollingService.ts` war der letzte bestaetigte Rest.
- Kein weiterer Verweis auf `preview_page/helpers.ts::withTimeout(...)` gefunden; Entfernung ist damit direkt abgesichert.
- Im Search-Pass verbleiben ausserhalb dieses Minimal-Scopes noch einige Timeout-Meldungen mit allgemeinen URL-Strings in Edge-/GitHub-Helfern. Sie leaken im geprueften Stand keine Tokens oder signierten Download-URLs, wurden in diesem Patch aber bewusst nicht breit angefasst.

## Validierung
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent` ⚠️ einmaliger lokaler Timeout in `__tests__/localRemoteDiffSection.truthfulness.test.tsx`
- `npm run test:silent -- --runInBand __tests__/buildPollingService.test.ts __tests__/previewEdgeErrorContract.test.ts __tests__/githubWorkflowLogs.security.invariants.test.ts __tests__/credentialsWizardInvokeEdgeJson.test.ts __tests__/useGitHubActionsLogs.contract.test.tsx __tests__/previewHelpers.test.ts` ✅
- `npm run test:silent -- --runInBand __tests__/localRemoteDiffSection.truthfulness.test.tsx` ✅
- `git diff --check` ✅
