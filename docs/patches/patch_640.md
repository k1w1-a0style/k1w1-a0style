# Patch 640 - Refactor Durchlauf 2 (Connections + Review-Fixes)

## Ziel
- Durchlauf 2 als sicheren helper-first Refactor auf einem bestaetigten Hotspot umsetzen.
- Inline-Review-Hinweise aus PR 507 direkt korrigieren.

## Umgesetzt
1. Connections-Hotspot (`useConnectionsScreen`):
   - Neues pure Helper-Mapping `resolveEasProjectVerification(...)` in `useConnectionsScreenHelpers.ts`.
   - `testEas` nutzt jetzt den Helper statt inline State-/Timestamp-Ableitung.
   - Kein Flow-/Contract-/Auth-Umbau, nur Logik-Entkopplung.

2. Review-Fix 1 (Traceability):
   - `docs/TODO.md`-Eintraege fuer bereits abgeschlossene Punkte behalten wieder ihre originalen Patch-IDs (`636`/`637`/`638`) statt Retagging.

3. Review-Fix 2 (Inventar-Zahl):
   - `docs/04-risk-hotspots.md` Vollscanwert fuer `as any` auf den reproduzierbaren aktuellen Wert korrigiert (`341`).

## Verifikation
```bash
npm run test:silent -- --runInBand __tests__/useConnectionsScreenHelpers.test.ts __tests__/connectionsScreen.screen.test.tsx __tests__/connectionsScreen.validation.test.ts
npm run typecheck
npm run lint:ci
npm run test:silent
git diff --check
bash scripts/check_patch_docs_sync.sh
```
