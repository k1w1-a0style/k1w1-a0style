# Patch 312 — One-Click Deploy: Secrets Auto-Sync als Opt-in

## Ziel
Den offenen TODO-Punkt zur Build-Vorstufe abschließen: **Auto-Sync von GitHub Secrets vor Build ist nicht mehr implizit aktiv**, sondern explizit opt-in.

## Änderungen
1. **Persistente Option eingeführt**
   - Neuer Storage-Key: `ONE_CLICK_AUTO_SYNC_SECRETS`.
   - Hook `useOneClickDeploy` lädt/speichert die Option in AsyncStorage.

2. **One-Click Deploy Verhalten geändert**
   - Default ist jetzt **AUS**.
   - Step „Secrets synchronisieren“ wird bei deaktivierter Option als `skip` mit Detail „Auto-Sync deaktiviert“ markiert.
   - Bei aktivierter Option läuft der bisherige Sync-Prozess unverändert.

3. **UI-Feedback im Deploy-Card**
   - Neues Toggle-Element („AN/AUS“-Lampe) in `OneClickDeployCard`.
   - Nutzer sieht direkt, ob der Pre-Build-Secrets-Sync aktiv ist.

4. **TODO-SoT aktualisiert**
   - Offener Punkt unter Patch 107 als erledigt markiert.

## Verifikation
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
