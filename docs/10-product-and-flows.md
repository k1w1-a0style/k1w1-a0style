# 10 — Product & Flows (Was ist die App? Wie benutzt man sie?)

Stand: 2026-03-02

## One-liner
Die App ist ein **Expo/React-Native Build-Orchestrator**, der Repo-Selection, Diagnostics/Fix-Loops und den Build-Start in einem UI-Flow bündelt.  
Technisch läuft der Build-Start zentral über `ProjectContext.startBuild` → `startBuildJob`.

## Was die App konkret tut
- Verwaltet das aktuell verknüpfte Ziel-Repo + Branch (`projectData.linkedRepo`, `projectData.linkedBranch`).
- Prüft Build-Readiness über lokale und Pipeline-Diagnostics.
- Bietet AutoFix-Patches für häufige Build-Blocker (z. B. `eas.json`, Workflow-Quoting, Expo Config).
- Startet den Build über Supabase Edge Function Trigger + zeigt Verlauf/Status im Build-Screen.

## Kern-Journeys (Happy + Failure)

### Journey 1 — Quick Happy Path: “Von Null zu erstem Build”
**Preconditions**
- GitHub Token und Expo Token gesetzt (`Connections`).
- Repo und Branch gewählt (`GitHub Repos`).

**Steps**
1. **GitHub Repos**: Repo auswählen + Branch auswählen.
2. **Diagnose**: `Run diagnostics` ausführen.
3. Falls Issues vorhanden: `Smart Fix` (oder Issue öffnen → `Auto-Fix anwenden`) und danach nochmal `Run diagnostics`.
4. **Build**: Build-Profil wählen und `Start Build`.

**Expected Output**
- `diagnostic_last_ok` wird auf `true` gesetzt.
- Build startet, `jobId` (UUID) kommt zurück.
- Verlauf/Status im Build-Screen sichtbar.

---

### Journey 2 — Failure Path: `repo.easProjectId` FAIL
**Preconditions**
- Repo/Branch gesetzt, Diagnostics erreichbar.

**Steps**
1. **Diagnose** ausführen.
2. Bei Check `repo.easProjectId` in der Issue-Detailansicht `Auto-Fix anwenden` (EAS Link Workflow Dispatch).
3. Optional in **GitHub Repos** Secrets/Workflow status prüfen.
4. `Run diagnostics` erneut ausführen.

**Expected Output**
- `repo.easProjectId` wird `pass` oder zumindest in einen klaren Manual-Next-Step überführt.
- Danach kann Build-Gate wieder passieren.

---

### Journey 3 — Failure Path: Workflow YAML quoting (`workflow-yaml-name-colon-quoting`)
**Preconditions**
- Workflow-Dateien im Repo vorhanden.

**Steps**
1. **Diagnose** ausführen.
2. Betroffenes Issue öffnen.
3. `Patch Vorschau` prüfen.
4. `Auto-Fix anwenden`.
5. `Run diagnostics` erneut ausführen.

**Expected Output**
- YAML-`name:` Zeilen mit `": "` sind gequotet.
- Check wird `pass`.

---

### Journey 4 — Failure Path: EXPO_TOKEN fehlt
**Preconditions**
- Repo existiert, GitHub Zugriff vorhanden.

**Steps**
1. **Diagnose** ausführen (`repo.secret.expoToken` fail).
2. **GitHub Repos** → `Secrets synchronisieren` (falls Token lokal vorhanden), alternativ GitHub manuell setzen.
3. `Run diagnostics` erneut ausführen.

**Expected Output**
- Check `repo.secret.expoToken` wird `pass`.
- Build-Readiness für tokenbezogene Blocker ist erfüllt.

---

### Journey 5 — Production Readiness Check
**Preconditions**
- Repo/Branch gesetzt.
- Production-Profil gewählt.

**Steps**
1. **Credentials Wizard**: Production-Key-Status prüfen.
2. **Diagnose**: vollständigen Lauf starten.
3. Fehlschläge fixen (Autofix oder Manual).
4. **Build**: `production` auswählen, `Start Build`.

**Expected Output**
- Keine offenen Blocker für Branch + Diagnostic state.
- Buildtrigger läuft mit `profile=production`.

## Non-goals (bewusst NICHT im Scope)
- Kein Ersatz für vollständige GitOps/CI-Administration außerhalb der unterstützten Workflows.
- Keine automatische Secret-Rotation bei Leak-Verdacht (nur Hinweise + sichere Defaults/Manual Steps).
- Kein vollwertiger Ersatz für EAS/GitHub Debugging in deren nativen UIs (App zeigt Status/Checks, aber nicht jedes Low-Level-Detail).
- Kein stilles Erraten von Repo/Branch im Startpfad; User-Selektion bleibt Pflicht.

## Referenzen
- State & Persistenz: `docs/01-state-contract.md`
- Build pipeline: `docs/02-build-pipeline.md`
- Screen-Map: `docs/03-screen-index.md`, `docs/13-screen-flow-map.md`
- Diagnostics Fixes: `docs/07-diagnostics-fix-playbook.md`
- Operator Runbook: `docs/runbooks/APP_RUNBOOK.md`
