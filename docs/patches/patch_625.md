# Patch 625 — Deep-Scan P1 Follow-up (klein, evidenzbasiert)

## Ziel

Die im Deep-Scan als offen markierten P1-Restpunkte mit kleinem, testbarem Scope schliessen:

1. Fresh-Checkout/Trust-Follow-up zentral dokumentieren.
2. `testEas` Busy-UX an bestehende Busy-Guard-Semantik angleichen.
3. `docs/TESTING_GUIDE.md` auf aktuellen Stand ziehen.
4. Naechsten selektiven Runtime-`as any`-Hotspot abbauen (`lib/diagnostics/ciAutoFix.ts`).
5. Audit-/Inventar-Doku (`docs/04-risk-hotspots.md`, `docs/TODO.md`) minimal synchronisieren.

## Umsetzung

- Neuer zentraler Green-Path: `docs/FRESH_CHECKOUT_GREEN_PATH.md`.
- `docs/TESTING_GUIDE.md` auf den realen Verify-Flow reduziert (ohne historische Umgebungsartefakte).
- `testEas` in `useConnectionsScreen` laeuft jetzt wie `testGitHub`/`testExpo`/`testSupabase` ueber `withBusyGuard` und meldet Busy-Kollisionen explizit via `Alert("Bitte warten", ...)`.
- `lib/diagnostics/ciAutoFix.ts` ersetzt `as any` in Error-Pfaden durch `unknown`+Narrowing (`toErrorMessage`).
- Doku-Sync in README/INDEX/TODO/Risk-Hotspots/Checklog/Patchlog.

## Verifikation

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
npm run test:silent -- --runInBand __tests__/connectionsScreen.flowGuards.invariants.test.ts
```
