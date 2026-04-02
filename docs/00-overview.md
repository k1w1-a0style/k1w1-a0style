# 00 — Overview

Stand: **2026-04-02 (Docs Konsolidierung)**

## Zielbild

k1w1-a0style fuehrt Operatoren durch eine stabile Kette:

1. **Repo/Branch setzen**
2. **Verbindungen / Secrets pruefen**
3. **Diagnostics ausfuehren und Fix-Loops schliessen**
4. **Build nur bei gruener Readiness starten**
5. **Status / History / Logs kontrolliert verfolgen**

## Aktueller Repo-Status

- keine offenen bestaetigten Repo-Muss-Punkte im aktuell geprueften Stand
- produktive Deploy-/Workflow-Flows bleiben explizit ref-gesteuert
- Build-/Workflow-/Artifact-/Keystore-Routen bleiben fail-closed und auth-/scope-gebunden
- `create_codesandbox` ist deaktiviert und **kein** aktiver Produktpfad mehr

## Source of Truth

- **Repo/Branch:** `projectData.linked*`
- **Build-Readiness:** selection-scoped Diagnostics und explizite Preconditions
- **Build-Laufkontext:** `currentBuild.githubRepo` + `currentBuild.runId`
- **Edge-/Auth-Vertraege:** `docs/EDGE_FUNCTIONS_STATUS.md` und `docs/06-build-readiness.md`
- **Restpunkte / aktueller Stand:** `docs/TODO.md` + `docs/reviews/Review.md`

## Nicht-Ziele dieses Dokuments

- keine Patch-Historie im Detail
- kein Incident-Runbook
- keine Parallel-Review

Dafuer gelten:
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/runbooks/APP_RUNBOOK.md`
