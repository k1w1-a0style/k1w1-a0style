# Patch 601: Finaler Legacy-Compat-Cleanup fuer Edge-Admin-Key-Reste + test-Route fail-closed

## Ziel

Die letzten generischen `get/save/deleteEdgeAdminKey(...)`-Reste aus produktiven/scoped App-Pfaden entfernen, verbleibende Compat-Nutzung explizit halten und die stray Route `supabase/functions/test` mit klarem, fail-closed Vertrag absichern.

## Geaenderte Bereiche

1. **Explizite Legacy-Compat-APIs statt generischer Helper-Namen**
   - Betroffene App-/Diagnostics-/Wizard-/Secrets-/Orchestrator-Pfade verwenden jetzt konsistent:
     - `getLegacyEdgeAdminKey(...)`
     - `saveLegacyEdgeAdminKey(...)`
     - `deleteLegacyEdgeAdminKey(...)`
   - Generische Helper-Namen bleiben nur als compat-scope in `infra/github/tokenStore.ts` (inkl. tokenStore-Compat-Test) erhalten.

2. **Stray `supabase/functions/test` final behandelt (fail-closed)**
   - Route nutzt jetzt scoped Legacy-Guard:
     - `requireScopedEdgeAuth(req, { adminSecretEnv: "K1W1_EDGE_ADMIN_KEY", allowCiBearer: false })`
   - Erfolgsantwort entfernt; stattdessen bewusst immer:
     - HTTP `410`
     - `code: "legacy_test_route_disabled"`
   - Damit bleibt keine halboffene/alte Testflaeche mit unklarem Auth-Vertrag im Repo.

3. **Checks/Invariants nachgezogen**
   - Neu: `__tests__/legacyEdgeAdminCompat.invariants.test.ts`
     - blockiert neue generische `get/save/deleteEdgeAdminKey`-Primaernutzung ausserhalb expliziter Compat-Ausnahmen.
   - Aktualisiert: `__tests__/edgeCorsRequestBound.invariants.test.ts`
     - sichert fuer `supabase/functions/test` scoped Guard + `410 legacy_test_route_disabled`.
   - Erweitert: `scripts/check_workflow_edge_contracts.sh`
     - enthaelt jetzt explizite Vertragspruefungen fuer `supabase/functions/test`.

## Bewusst unveraendert

- Kein neues Security-Modell; scoped-key-Vertrag bleibt bestehen.
- Keine grossen UI-/Architektur-Refactors.
- Historische Patch-Dokus bleiben inhaltlich unverfaelscht.

## Ergebnis

- Keine unnoetigen generischen Edge-Admin-Key-Primary-Reads/Writes mehr in aktuellen produktiven/scoped Pfaden.
- Legacy-Compat bleibt explizit, lokal begrenzt und regressionsgesichert.
- `supabase/functions/test` ist klar dokumentiert und fail-closed gehaertet.
