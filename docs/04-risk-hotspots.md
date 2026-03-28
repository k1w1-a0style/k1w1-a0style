# 04 — Risk Hotspots

## Top-Risiken (priorisiert)

## R1 — Branch-Fallback auf `main` im kritischen Pfad
**Risiko:** Build/Workflow können gegen falschen Branch laufen, obwohl User andere Auswahl erwartet.  
**Auswirkung:** Falscher Commit/Workflow-Kontext, inkonsistente Diagnosen.

**Fundstellen:**
- `project/services/buildStartService.ts` (`bestEffortPushToGitHub`, Return `branch || "main"`)
- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts` (EAS-Link branch fallback)
- `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts` (mehrere Sync/Repo-Operationen)
- `screens/DiagnosticScreen/hooks/diagnosticRunners.ts`, `useDiagnosticFixRunner.ts`

**Fix-Vorschlag:**
1. Harten Branch-Guard einführen: wenn Branch leer ⇒ blockieren mit UI-Fehler.
2. Fallbacks auf `main` entfernen.
3. Nur explizit ausgewählte Branches dispatchen.

---

## R2 — Dual-Write zwischen `active*` (GitHubContext) und `linked*` (ProjectData)
**Risiko:** temporäre Divergenz/Migrationsdrift bei Import/Hydration.  
**Auswirkung:** Screen A zeigt andere Auswahl als Screen B.

**Fundstellen:**
- `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
- `screens/AppInfoScreen/hooks/useAppInfoScreen.ts`
- `contexts/GitHubContext.tsx` (persistiert `active*`, spiegelt aber aus `linked*`)

**Fix-Vorschlag:**
1. `linked*` als einziges Schreibziel definieren.
2. `active*` nur als derived read-model führen (kein eigener User-Write außer Mirror-Mechanik).
3. Import-Flow: nur `setLinkedRepo` schreiben; Mirror folgt automatisch.

---

## R3 — Repo-Fallback via `CONFIG.BUILD.GITHUB_REPO`
**Risiko:** Build startet auf statischem/notfall Repo statt User-Selektion.  
**Auswirkung:** Harte Kopplung, falsches Zielrepo.

**Fundstellen:**
- `contexts/ProjectContext.tsx` (`pd.linkedRepo?.trim() || CONFIG.BUILD.GITHUB_REPO`)
- `project/services/buildStartService.ts` (gleicher Fallback)

**Fix-Vorschlag:**
1. Build blocken, wenn `linkedRepo` fehlt.
2. Config-Fallback nur für expliziten Dev-Testmodus erlauben (Feature Flag + Hinweis).

---

## R4 — Diagnostic/CI-Flags als String-Storage ohne Versionierung
**Risiko:** Alte Keys/States können missverstanden werden; keine Run-Korrelation.  
**Auswirkung:** UI zeigt „grün“, obwohl Zustand alt ist.

**Fundstellen:**
- `lib/storageKeys.ts`
- `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts`
- `screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts`

**Fix-Vorschlag:**
1. Statusobjekt mit Timestamp/Version (z. B. `diagnostic_last_result_v2`) einführen.
2. Build-Precondition kann „stale“ Runs (zu alt) als pending markieren.

---

## R5 — ProjectId/ersId Contract unvollständig dokumentiert
**Risiko:** Unklare Ownership bei EAS Project ID, keine sichtbare `ersId`-Quelle gefunden.  
**Auswirkung:** Lücken im verbindlichen Datenvertrag.

**Status:** **UNSICHER**
- `EAS_PROJECT_ID` ist klar via `AsyncStorage` belegbar.
- `ersId` konnte im geprüften Code nicht gefunden werden.

**Zu prüfen:**
1. Externe Edge-Function Payloads / Backend-Kontrakte (falls `ersId` dort geführt wird).
2. Eventuelle Alt-Dokumente oder Umbenennungen (`easProjectId` vs `ersId`).

---

## Evidence

### Evidence A — Branch fallback im Build-Service
**Datei:** `project/services/buildStartService.ts`  
**Symbol:** `bestEffortPushToGitHub`
```ts
if (!branch) {
  try {
    branch = (await getDefaultBranch(owner, repo)).trim();
  } catch {
    branch = "main";
  }
}
if (!branch) branch = "main";
```

### Evidence B — Connection-Flow fallback auf main
**Datei:** `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`  
**Symbol:** `onLinkExisting`/`onCreateAndLink`
```ts
const branch =
  (activeBranch || projectData?.linkedBranch || "main").trim() || "main";
```

### Evidence C — Repo-Fallback via Config
**Datei:** `project/services/buildStartService.ts`  
**Symbol:** `startBuildJob`
```ts
const githubRepo = (project.linkedRepo?.trim() || CONFIG.BUILD.GITHUB_REPO).trim();
```

### Evidence D — Diagnostics/CI Flags nur key/value
**Datei:** `lib/storageKeys.ts`  
**Symbol:** `STORAGE_KEYS`
```ts
DIAGNOSTIC_LAST_OK: "diagnostic_last_ok",
CI_LITE_LINT_OK: "ci_lite_lint_ok",
CI_LITE_TYPECHECK_OK: "ci_lite_typecheck_ok",
```

## R6 — Workflow-Operator-RBAC bisher zu breit (`authenticated`)
**Risiko:** Breite JWT-Rolle `authenticated` auf privilegierten workflow-/build-/artifact-Routen vergroessert die Angriffsoberflaeche fuer Operator-Aktionen.
**Auswirkung:** Nicht-admin User-JWTs koennen unnötig weitreichende Operator-Routen erreichen, wenn zusaetzliche Guards falsch konfiguriert sind.

**Fundstellen (historisch, vor Patch 586):**
- `trigger-eas-build`, `check-eas-build`, `github-workflow-dispatch`, `github-workflow-runs`, `github-workflow-logs`, `github-run-artifact-json`

**Hardening-Stand (Patch 586):**
1. JWT-Rollen auf `service_role` + `build_admin` eingeschraenkt (fail-closed).
2. CI-Bearer-/scoped-admin-key-Dualpfad bleibt unveraendert.
3. Shared SoT (`WORKFLOW_OPERATOR_ALLOWED_ROLES`) verhindert Rollen-Drift zwischen Routen.

---

### Evidence E — `ersId` nicht gefunden (Search Evidence)
**Command:** `rg -n "ersId" contexts screens lib infra project shared`
```txt
(no matches)
```
