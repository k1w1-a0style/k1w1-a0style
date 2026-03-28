# Patch 603: Legacy-Teststub `supabase/functions/test` gegen Guard-Misconfiguration fail-closed repariert

## Ausgangslage

Die Legacy-Testroute `supabase/functions/test` sollte bewusst disabled sein und immer `410 legacy_test_route_disabled` liefern.

Tatsaechlich war der `requireScopedEdgeAuth(...)`-Aufruf dort unvollstaendig konfiguriert:

- `adminSecretEnv: "K1W1_EDGE_ADMIN_KEY"`
- `allowCiBearer: false`
- aber **ohne** `allowAdmin: true`
- und ohne klaren `scope`

Damit konnte `requireScopedEdgeAuth(...)` in eine Auth-Misconfiguration laufen (`500`), bevor die Route den beabsichtigten disabled-Vertrag (`410`) erreichte.

## Umsetzung

1. **Route-Fix in `supabase/functions/test/index.ts`**
   - Guard jetzt explizit mit:
     - `scope: "test"`
     - `adminSecretEnv: "K1W1_EDGE_ADMIN_KEY"`
     - `allowAdmin: true`
     - `allowCiBearer: false`
   - Der Response-Pfad bleibt unveraendert fail-closed:
     - `status: 410`
     - `code: "legacy_test_route_disabled"`

2. **Contract-Check gehaertet (`scripts/check_workflow_edge_contracts.sh`)**
   - Fuer `supabase/functions/test/index.ts` wird jetzt explizit geprueft:
     - scoped guard call vorhanden,
     - `scope: "test"`,
     - `adminSecretEnv: "K1W1_EDGE_ADMIN_KEY"`,
     - `allowAdmin: true`,
     - `allowCiBearer: false`,
     - `status: 410`,
     - `legacy_test_route_disabled`.

3. **Invariants nachgeschaerft**
   - `__tests__/edgeCorsRequestBound.invariants.test.ts` prueft fuer die Testroute jetzt zusaetzlich `allowAdmin: true` und `scope: "test"`.
   - Neuer fokussierter Invariant-Test:
     - `__tests__/patch603.legacyTestRouteAuthContract.invariants.test.ts`
     - deckt Route-Vertrag **und** Script-Check-Absicherung gegen genau diese Fehlkonfiguration ab.

4. **Doku-Sync**
   - README, PROJECT_CHECKLOG, PATCHLOG_ROOT, EDGE_FUNCTIONS_STATUS, Risk-Hotspots und Build-Readiness auf Patch-603-Stand aktualisiert.

## Ergebnis

- Kein vorzeitiges `500` mehr durch Guard-Misconfiguration auf `supabase/functions/test`.
- Legacy-Teststub bleibt streng disabled/fail-closed (`410 legacy_test_route_disabled`).
- Der konkrete Guard-Fehler kann durch Script-Check + Invariants nicht mehr still durchrutschen.
