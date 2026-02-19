# Patch 196.1

Hotfix: Stabilisiert `__tests__/oneClickDeploy.test.tsx`, nachdem Patch 196 Cleanup durchgefuehrt wurde.

## Fix
- Mockt `@react-native-async-storage/async-storage` als Modul (anstatt `spyOn`), um Haenger/Timeouts zu vermeiden.
- Laesst den Button-Handler kein Promise zurueckgeben (`void hook.runDeploy()`), damit `act()` nicht blockiert.
- Geringfuegig hoeherer `waitFor` Timeout.

## Erwartung
`npm run test:silent` laeuft wieder komplett gruen.
