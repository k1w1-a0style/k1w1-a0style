# 10 — Product & Flows (Executive + Operator View)

Stand: 2026-03-12

## Was ist die App?
Expo/React-Native Build-Orchestrator für mobile Repo-Flows: Repo/Branch-Auswahl, Verbindungen, Diagnostics/Fix, Build-Start und Status in einer Operator-Kette.

## Kern-Journeys

### 1) First Build
1. `GitHub Repos`: Repo + Branch wählen.
2. `Diagnose`: Scan ausführen.
3. Offene Punkte fixen (`Smart Fix`/`Auto-Fix`/manuell).
4. `Build`: Profil wählen und Build starten.

Erwartung: Build-Gate erfüllt, Build-Job erscheint in Status/Historie und liefert eine **positive numerische `jobId`**.

### 2) EAS Link fehlt (`repo.easProjectId` FAIL)
1. `Diagnose`: Scan.
2. Issue-Fix (Auto-Fix oder `GitHub Repos` → EAS link/create).
3. Recheck.

Erwartung: Check wird `pass` oder zeigt klaren manuellen Next Step.

### 3) Repo Secret fehlt (`repo.secret.expoToken` FAIL)
1. `Diagnose`: Scan.
2. `GitHub Repos` → `Secrets synchronisieren`.
3. Ggf. manuell in GitHub nachziehen.
4. Recheck.

### 4) Workflow-Quoting-Fehler
1. `Diagnose`: Scan.
2. Issue öffnen, Patch-Vorschau prüfen.
3. Auto-Fix anwenden, Recheck.

### 5) Production Build
1. `Credentials Wizard`: Signing prüfen.
2. `Diagnose`: Scan + Fix-Loop.
3. `Build`: `production` starten.

### 6) Diagnostics Upload
1. `Diagnose`: Run.
2. Upload starten.
3. Optional Retry im gleichen Request-Fenster.

## Häufige Failure-Shortcuts
- Branch fehlt → in `GitHub Repos` setzen.
- `diagnostic_last_ok != true` → Diagnose/Fix-Loop wiederholen.
- Dispatch/EAS-Link-Probleme → EAS-Link + Workflow-Ref prüfen, dann Recheck.

## Non-goals
- Kein Ersatz für native GitHub/EAS-Debug-UIs.
- Keine automatische Secret-Rotation/Forensik.
- Kein stilles Erraten von Repo/Branch im Build-Startpfad.

## Referenzen
- `docs/06-build-readiness.md`
- `docs/07-diagnostics-fix-playbook.md`
- `docs/04-testing-smoke-plan.md`
- `docs/runbooks/APP_RUNBOOK.md`
