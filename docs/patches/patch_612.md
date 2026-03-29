# Patch 612

## Anlass
Im Build-Start-Pfad gab es einen Korrektheitsfehler im `out_of_sync`-Fall: Wenn der vorgelagerte Repo-Sync einen Push brauchte und `pushFilesToRepo(...)` fehlschlug, wurde der Fehler nur als Warnung behandelt. Der Flow konnte danach trotzdem mit Workflow-Autofix/Bootstrap und Build-Dispatch weiterlaufen.

Das war fachlich falsch, weil auf ungepushtem bzw. unsicherem Repo-Stand kein Build gestartet werden darf.

## Umsetzung
- `project/services/buildStartService.ts`
  - Den bisherigen Best-Effort-Helper `bestEffortPushToGitHub(...)` durch einen fail-closed Guard ersetzt: `pushProjectFilesOrAbortBuild(...)`.
  - Push-Fehler werden nicht mehr verschluckt; stattdessen harter Abbruch mit klarer Fehlermeldung:
    - `Build abgebrochen: Lokale Aenderungen konnten nicht erfolgreich ins Ziel-Repo gepusht werden.`
  - Dadurch ist die Guard-Reihenfolge jetzt strikt: Push muss erfolgreich sein, bevor Workflow-Autofix/Bootstrap oder Dispatch ueberhaupt erreicht werden koennen.
- `lib/__tests__/buildStartService.integration.test.ts`
  - Regressionstest gehaertet: `pushFilesToRepo(...)`-Fail fuehrt zu Abbruch.
  - Explizite Vertragsasserts: Bei Push-Fail kein `autoFixCIWorkflows(...)` und kein Supabase-Dispatch (`invoke(...)`).
- Doku-Sync aktualisiert (`README.md`, `PROJECT_CHECKLOG.md`, `docs/patches/PATCHLOG_ROOT.md`, `docs/06-build-readiness.md`, `docs/04-risk-hotspots.md`).

## Ergebnis
Der Build-Start ist an der Repo-Sync-Kante jetzt fail-closed:
- Push-Fehler => harter Abbruch
- kein Workflow-Bootstrap nach Push-Fail
- kein Workflow-Dispatch/Build-Run nach Push-Fail
- UI/Caller sehen einen klaren Abbruchfehler statt irrefuehrender Teil-Erfolge.
