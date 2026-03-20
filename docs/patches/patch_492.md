# Patch 492 — GitHubReposScreen Pull-/Push-/Sync-Wahrheit härten

## Ziel

Der GitHubReposScreen soll Pull, Push, Preview-Anwenden und Sync-Status fachlich dieselbe Wahrheit sprechen lassen:

- kein voreiliges „Pull angewendet“, bevor der lokale Projekt-Write wirklich fertig ist,
- keine Sync-Signatur für halbe, übersprungene oder fehlgeschlagene Pulls,
- ehrliche Unterscheidung zwischen **angewendet**, **no-op**, **teilweise angewendet** und **fehlgeschlagen**,
- kein false green im Push-Pfad bei leerer Auswahl oder fehlendem Branch.

## Umsetzung

### 1) Pull-Apply-Reihenfolge gehärtet

In `useGitHubReposScreen` läuft der lokale Apply-Schritt jetzt nicht mehr fire-and-forget:

- der Pull-Apply-Pfad berechnet zuerst eine kleine gemeinsame Semantik,
- `updateProjectFiles(...)` wird bei echten lokalen Änderungen **awaited**,
- erst danach folgen ggf. `markRepoSyncSignature(...)`, `refreshSyncStatus()` und der abschließende Alert,
- schlägt der lokale Write fehl, endet der Flow nur noch mit einem Fehleralert.

### 2) Gemeinsame Pull-Semantik eingeführt

Neue Utility: `screens/GitHubReposScreen/utils/pullApplySemantics.ts`

Sie klassifiziert Pull-Ergebnisse zentral als:

- `applied`
- `noop`
- `partial`

und liefert dazu:

- die tatsächlich zu schreibenden `mergedFiles`,
- ob überhaupt ein lokaler Write nötig ist,
- ob eine Sync-Signatur fachlich erlaubt ist,
- ehrliche Alert-Texte.

Wichtige Regeln:

- **no-op**: Remote war bereits lokal vorhanden → kein Write, kein voller Erfolgston; Sync kann als unverändert aktuell markiert bleiben.
- **partial** bei `skipConflicts`: übersprungene Konflikte werden explizit als teilweise angewendet behandelt; kein false-green Sync.
- **applied**: nur wenn der lokale Zustand wirklich auf den neuen fachlichen Stand gebracht wurde.

### 3) Push-Semantik nachgezogen

Der Push-Confirm-Pfad prüft vor einem echten Push jetzt konservativer:

- keine Erfolgsmeldung bei leerer Auswahl,
- keine Erfolgsmeldung bei Auswahl ohne lokale Dateien,
- keine Erfolgsmeldung ohne Branch,
- Sync-Refresh wird nach erfolgreichem Push jetzt vor dem Success-Alert awaited.

### 4) UX-/Text-Semantik geschärft

Die Pull-Vorschau erklärt jetzt klarer:

- `Overwrite` = Remote gewinnt bei Konflikten,
- `Skip Konflikte` = lokal behalten **und bewusst nicht als vollständig synchron markieren**.

## Tests

Neue fokussierte Jest-Regressionen decken ab:

1. lokaler Pull-Write wird wirklich awaited, bevor Signatur/Refresh/Success laufen,
2. fehlgeschlagener lokaler Apply setzt weder Sync-Signatur noch Success,
3. no-op-Pull wird nicht als normaler Erfolg klassifiziert,
4. `skipConflicts` bleibt ehrlich teilweise statt false green,
5. Push-Guards verhindern falsche Success-Semantik bei leerer Auswahl oder fehlendem Branch,
6. echter erfolgreicher Pull bleibt sauber erfolgreich mit konsistenter Reihenfolge.

## Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
