# Patch 557 — Notification Push-Haertung (projectId + Permission-State + Log-Schutz)

## Kontext

Im Notification-Block gab es drei regressionsanfaellige Restpunkte:

- `lib/notificationService.ts` nutzte fuer `getExpoPushTokenAsync(...)` einen unpassenden Fallback (`owner`/Platzhalter), was in realen Umgebungen zu falschen/instabilen `projectId`-Aufrufen fuehren konnte.
- Sensitive Logging war zu breit: der rohe Expo Push Token wurde in Logs ausgegeben.
- `hooks/useNotifications.ts` aktualisierte bei `requestPermissions()` nicht den kompletten Hook-State, wodurch nach spaeterem Permission-Grant stale/null Zustand entstehen konnte.

## Umsetzung

1. `notificationService` robust/fachlich korrigiert:
   - neue zentrale `resolveProjectId()`-Ermittlung mit priorisierten, echten Expo/EAS-Quellen:
     - `Constants.easConfig?.projectId` (primaer)
     - `Constants.expoConfig?.extra?.eas?.projectId`
     - `Constants.manifest2?.extra?.expoClient?.extra?.eas?.projectId`
   - kein Owner-/Placeholder-Fallback mehr
   - wenn keine valide `projectId` vorhanden: klarer Warn-Log + token registration wird sauber uebersprungen (kein falscher Request)
2. Sensitive Logging gehaertet:
   - kein Loggen des Push-Token-Werts mehr
   - stattdessen nur nicht-sensitive Status-Logs
3. Stale-State-Risiko in `useNotifications` behoben:
   - sowohl im Initial-Flow als auch in `requestPermissions()` werden jetzt konsistent gesetzt:
     - `isInitialized`
     - `hasPermissions`
     - `pushToken`
   - dadurch bleibt der Hook nach erneutem Berechtigungsdialog wahrheitsgemaess synchron
4. Schlanke Regression-Absicherung:
   - `lib/__tests__/notificationService.test.ts` um projectId-Prioritaet/Fallback/No-projectId sowie Token-Logging-Guard erweitert
   - neuer Hook-Regressionstest fuer Permission-Regrant/-Revoke-State-Synchronitaet

## Geaenderte Dateien

- `lib/notificationService.ts`
- `hooks/useNotifications.ts`
- `lib/__tests__/notificationService.test.ts`
- `__tests__/useNotifications.permissions.regression.test.tsx`
- `docs/patches/patch_557.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `PROJECT_CHECKLOG.md`

## Risiko / Warum wichtig

- Falsche `projectId`-Herleitung fuehrt zu schwer nachvollziehbaren Push-Registrierungsfehlern.
- Token-Logging ist ein Security-/Privacy-Risiko.
- Inkonsistenter Hook-State erzeugt false-negative/false-positive UI-Informationen nach Permission-Aenderungen.

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `npm run test:silent -- --runInBand lib/__tests__/notificationService.test.ts __tests__/useNotifications.permissions.regression.test.tsx`
