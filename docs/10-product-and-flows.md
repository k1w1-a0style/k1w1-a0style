# 10 — Product & Flows (Executive + Operator View)

Stand: 2026-03-09

## Was ist die App?
Die App ist ein Expo/React-Native Build-Orchestrator für mobile Projekt-Repos: Sie bündelt Repo-/Branch-Selektion, Verbindungschecks, lokale + Pipeline-Diagnostics, AutoFix-Patches und den Build-Start in einen konsistenten Operator-Flow. Der Build-Start läuft zentral über `ProjectContext.startBuild` und `startBuildJob`, inklusive Build-Gate für Branch und `diagnostic_last_ok`. 

## Kern-Journeys (Happy Path + reproduzierbare Operator-Schritte)

### 1) First Build (Happy Path)
**Preconditions**
- GitHub Token + Expo Token gesetzt (Screen `Verbindungen`).
- Repo + Branch gesetzt (Screen `GitHub Repos`, SoT: `projectData.linkedRepo` / `projectData.linkedBranch`).

**Schritte (Screens + Buttons)**
1. `GitHub Repos`: Repo wählen und Branch wählen.
2. `Diagnose`: `Scannen`.
3. Falls Issues: `Fixen` (Smart Fix) oder Issue öffnen → `Auto-Fix anwenden`.
4. `Diagnose`: erneut `Scannen` bis keine Blocker offen sind.
5. `Build`: Profil wählen und `Build starten`.

**Expected Result**
- Build-Gate ist erfüllt (`diagnostic_last_ok = true`, Branch gesetzt).
- Build-Job liefert aktuell eine positive numerische `jobId` (build_jobs bigint-backed) und erscheint in Status/Historie.

---

### 2) Repo EAS Link fehlt (`repo.easProjectId` FAIL)
**Preconditions**
- Repo/Branch gesetzt.

**Schritte**
1. `Diagnose`: `Scannen`.
2. Bei `repo.easProjectId` Issue öffnen → `Auto-Fix anwenden`.
3. Alternativ/ergänzend in `GitHub Repos`: `EAS Projekt erstellen/verbinden`.
4. `Diagnose`: `Scannen` (Recheck).

**Expected Result**
- `repo.easProjectId` wird `pass` oder zeigt nur noch klaren manuellen Next Step.

---

### 3) Fehlendes Repo Secret (`repo.secret.expoToken` FAIL)
**Preconditions**
- Lokaler Expo Token vorhanden.

**Schritte**
1. `Diagnose`: `Scannen`.
2. `GitHub Repos` → Sektion `Secrets` → `Secrets synchronisieren`.
3. Falls weiter FAIL: Secret in GitHub manuell prüfen/anlegen.
4. `Diagnose`: Recheck mit `Scannen`.

**Expected Result**
- `repo.secret.expoToken` wird `pass`.

---

### 4) Workflow-Quoting-Fehler (`workflow-yaml-name-colon-quoting` FAIL)
**Preconditions**
- Workflow-Dateien im Repo vorhanden.

**Schritte**
1. `Diagnose`: `Scannen`.
2. Issue öffnen.
3. `Patch Vorschau` prüfen.
4. `Auto-Fix anwenden`.
5. `Diagnose`: Recheck.

**Expected Result**
- Workflow `name:` mit `": "` sind korrekt gequotet, Check wird `pass`.

---

### 5) Production Build Readiness
**Preconditions**
- Repo/Branch gesetzt.
- Zielprofil `production`.

**Schritte**
1. `Credentials Wizard`: Signing-Status prüfen.
2. `Diagnose`: `Scannen`.
3. Offene FAIL/WARN Punkte fixen (AutoFix oder manuell).
4. `Build`: Profil `production` setzen und `Build starten`.

**Expected Result**
- Build mit `profile=production` startet ohne Gate-Blocker.

### 6) Diagnostics Upload
**Preconditions**
- Diagnostics-Resultate vorhanden.
- Upload wird aus `Diagnose` gestartet.

**Schritte**
1. `Diagnose`: `Run`.
2. `Diagnose`: `Upload`.
3. Optional Retry innerhalb derselben `client_request_id`-Window.

**Expected Result**
- Upload-RPC liefert eine opake Upload-ID zurück.
- Der Client behandelt diese ID nur noch als opaque string (bigint aktuell, uuid-artige Kompatibilität toleriert).

## Typische Failure Paths (Operator-Kurzlogik)
- **Branch fehlt** → Build-Gate blockiert (`ERR_BRANCH_MISSING`) → in `GitHub Repos` Branch setzen → Diagnostics re-run.
- **`diagnostic_last_ok != true`** → Build-Gate blockiert (`ERR_DIAGNOSTIC_NOT_GREEN`) → in `Diagnose` `Scannen` + Fix-Loop.
- **Workflow Dispatch 404 / EAS-Link fail** → in `GitHub Repos` `EAS Projekt erstellen/verbinden`, ggf. Workflow-Dateien/Repo-Ref prüfen, danach Recheck.
- **Diagnostics Upload driftet** → Patch 409 hält Client/RPC auf opaque upload ids zusammen; SQL-Vertrag bleibt aktuell bigint-backed.

## Non-goals (bewusst außerhalb Scope)
- Kein vollständiger Ersatz für GitHub/EAS native Debugging-UIs.
- Keine automatische Secret-Rotation/Incident-Forensik.
- Kein stilles Erraten von Branch/Repo im Build-Startpfad.

## Operator-Referenzen
- Build-Gate/Readiness: `docs/06-build-readiness.md`
- Diagnostics/Fix-Playbook: `docs/07-diagnostics-fix-playbook.md`
- Testabdeckung: `docs/08-test-coverage-matrix.md`
- Smoke-Ausführung: `docs/04-testing-smoke-plan.md`
- Runbook (Schritt-für-Schritt): `docs/runbooks/APP_RUNBOOK.md`
