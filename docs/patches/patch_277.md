# Patch 277: ConnectionsScreen EAS test compile fix

## Was gefixt wurde
- **TypeScript Build-Break** in `useConnectionsScreen.ts`:
  - `testEas` wurde in einem `useEffect` genutzt, bevor es deklariert war (TDZ / "used before declaration").
  - fehlende Helper-Funktion `saveConnEasOk` (Persist + State-Update) nach Refactor.
  - doppelte Keys im Return-Objekt (TS1117) durch Merge-Fehler.

## Umsetzung
- `saveConnEasOk(ok)` eingeführt: setzt `easOk` + persistiert in `AsyncStorage` via `STORAGE_KEYS.CONN_EAS_OK`.
- `testEas` hoist-sicher vor dem Auto-Test-`useEffect` definiert.
- Duplizierte `testEas`-Definition entfernt (es gab 2 Varianten nach Patch 276).

## Dateien
- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_277.md`
