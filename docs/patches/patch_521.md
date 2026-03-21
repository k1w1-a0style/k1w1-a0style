# Patch 521 — Lokalen Edge-Admin-Key-HTTP-Vertrag im Client bereinigen

## Ziel

Lokale Edge-Admin-Key-Calls im Wizard-/Preview-/CI-Lite-Scope sollen keinen fachlich falschen
`Authorization: Bearer ...`-Header mehr mitsenden. In diesem Scope ist `x-k1w1-admin-key`
der zustaendige Vertrag; ein Bearer-Header ist hier weder ein echter JWT noch ein Service-Role-Token
und kann den Requestpfad verfälschen bzw. zu unehrlichen 401-Symptomen beitragen.

## Umsetzung

1. `screens/CredentialsWizardScreen/hooks/credentialHelpers.ts`
   - `invokeEdgeJson(...)` sendet fuer lokale Admin-Key-Calls nur noch `x-k1w1-admin-key`.
   - Der bisherige zusaetzliche `Authorization: Bearer $adminKey`-Header wurde entfernt.
2. Regressionstests gehaertet:
   - `__tests__/credentialsWizardInvokeEdgeJson.test.ts` prueft den bereinigten Header-Vertrag direkt.
   - `__tests__/usePreview.serverContract.test.tsx` haelt fest, dass der Remote-Preview-Pfad weiter nur den lokalen Admin-Key-Header nutzt.
   - `__tests__/useCiLiteWorkflow.behavior.test.tsx` sichert denselben Header-Vertrag fuer CI-Lite-Dispatch ab.
   - `__tests__/credentialsWizard.trustSemantics.test.tsx` haelt fest, dass ein frischer 401/Auth-Fehler keinen alten persistierten Erfolg wie aktuelle Verifikation aussehen laesst.
3. Patch-Doku synchronisiert:
   - `README.md`
   - `PROJECT_CHECKLOG.md`
   - `docs/patches/PATCHLOG_ROOT.md`
   - `docs/patches/patch_521.md`

## Tests / Checks

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`

## Risiko / Scope

- Kein Server-/Guard-/CORS-Umbau.
- Keine neue Auth- oder Preview-Architektur.
- Diagnose-/Copy-Logik aus Patch 520 bleibt fachlich unveraendert; der stoerende Bearer-Nebenpfad ist lediglich entfernt.
