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

**Update (Patch 590):** Nach dem gehaerteten Edge-Eingang aus Patch 589 sind jetzt auch die tieferen branch-nahen Shared-Layer gehaertet: `infra/github/workflows.ts`, `infra/github/files.ts` und `infra/github/branchOps.ts` enthalten keine stillen `"main"`-Fallbacks mehr; fehlender Branch/Ref bricht fail-closed ab statt zu raten.

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

## R2b — False-Green-Risiko durch Legacy-Admin-Key
**Risiko:** UI/Diagnostics signalisieren Readiness, obwohl nur `K1W1_EDGE_ADMIN_KEY`/Legacy lokal gesetzt ist.
**Auswirkung:** Workflow-/Keystore-Routen schlagen spaeter fehl, obwohl Vorpruefung gruen wirkte.

**Fix-Stand (Patch 596):**
- Connections-UI und SecretsSection trennen lokale Workflow-/Keystore-/Legacy-Keys klar.
- Diagnostics prueft `local.workflowAdminKey` und `local.androidKeystoreExportAdminKey` explizit; Legacy ist nur Compat-Hinweis.
- Patch 597 zieht den Wizard-Caller-Vertrag fuer Keystore-Routen nach: `android-keystore-status`/`android-keystore-generate` laufen dort nur noch mit `Authorization: Bearer <Supabase user JWT>` plus dediziertem lokalem Keystore-Key (`x-k1w1-admin-key`).
- Patch 598 reduziert verbleibende Drift im Legacy-Admin-Guard: generisches `requireAdminKey(...)` akzeptiert keinen `SIGNING_ADMIN_KEY`-Fallback mehr; Legacy-Routen (`k1w1-handler`, `create_codesandbox`, `save_preview`, disabled lint/native-sync Stubs) nutzen jetzt explizite scoped Guards auf `K1W1_EDGE_ADMIN_KEY`.
- Patch 599 schliesst den Keystore-Config-Split-Brain: widerspruechliche lokale `verify_jwt=false`-Configs fuer `android-keystore-status`/`android-keystore-generate` wurden entfernt; fail-closed SoT ist jetzt eindeutig `supabase/config.toml` mit `verify_jwt=true`.
- Patch 600 entfernt verbleibende stille Legacy-Fallbacks in workflow-/build-/artifact-nahen Ops-Skripten: `scripts/ci-lite-env-load.sh` und `scripts/ci-lite-smoke.sh` verwenden nur noch `K1W1_EDGE_WORKFLOW_ADMIN_KEY` (kein `ADMIN_KEY`/`K1W1_EDGE_ADMIN_KEY`-Alias mehr), damit fehlende scoped Workflow-Keys nicht mehr als false-green durchlaufen.
- Patch 602 schliesst den verbleibenden JWT-/Ref-Vertragsbruch im selben Script-Scope: `scripts/ci-lite-smoke.sh` ruft JWT-pflichtige workflow-/build-nahe Routen nur noch mit `Authorization: Bearer <K1W1_EDGE_WORKFLOW_JWT>` plus scoped Workflow-Key auf und verlangt einen expliziten `<ref>` (kein stilles `main` mehr).
- Patch 601 schliesst den Restpunkt `supabase/functions/test` explizit: alte Testroute ist jetzt fail-closed (`requireScopedEdgeAuth` + immer `410 legacy_test_route_disabled`) und kann nicht mehr als halboffene Altflaeche mit unklarem Auth-Vertrag stehen bleiben.
- Patch 603 korrigiert den verbleibenden Vertragsfehler in genau dieser Testroute: der Scoped-Guard enthaelt jetzt verpflichtend `allowAdmin: true` und `scope: "test"`, damit keine `500`-Auth-Misconfiguration den beabsichtigten `410 legacy_test_route_disabled`-Pfad verdeckt; Contract-Checks/Invariants blocken die Rueckdrift explizit.

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

### Evidence A — Historischer Branch fallback im Build-Service (vor Hardening)
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

### Evidence B — Repo/Branch-SoT ist jetzt konsolidiert auf `projectData.linked*`
**Datei:** `contexts/GitHubContext.tsx`  
**Symbol:** abgeleitete Active-Selection
```ts
const activeRepo = useMemo(
  () => (hydrated ? normalizeLinkedGitHubValue(projectData?.linkedRepo) : null),
  [hydrated, projectData?.linkedRepo],
);
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
2. Der fruehere CI-bearer-Dualpfad wurde in Patch 606 entfernt; workflow-/build-/artifact-Routen nutzen jetzt nur noch den JWT+scoped-admin-key-Vertrag.
3. Shared SoT (`WORKFLOW_OPERATOR_ALLOWED_ROLES`) verhindert Rollen-Drift zwischen Routen.

**Follow-up (Patch 588):**
4. `android-keystore-generate` und `android-keystore-status` wurden auf denselben dedizierten Keystore-Scoped-Secret-Pfad (`K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY`) plus fail-closed JWT-RBAC (`service_role|build_admin`) gehoben; generischer `requireAdminKey(...)`-Pfad ist dort entfernt.
5. Patch 591 bereinigt den oeffentlichen `android-keystore-generate`-Vertrag: kein irrefuehrendes `branch`-Feld mehr, fachlicher Scope bleibt `repo + mode`.
**Follow-up (Patch 604):**
6. App-Caller-/Wizard-Fehltexte, Vertrags-Tests und Drift-Checks wurden auf denselben Operator-Vertrag gezogen; kein `JWT role=authenticated`-Wording mehr im app-initiierten Operator-Scope.
**Follow-up (Patch 605):**
7. Es gibt im Repo keinen internen Claim-Mapper/Grant-Flow fuer build_admin; der Operator-Claim ist ein externer Supabase-Provisioning-Vertrag (`user.role`/`user.app_metadata.role`) und wird entsprechend in UX/Diagnostics/Docs explizit benannt.

---

### Evidence E — `ersId` nicht gefunden (Search Evidence)
**Command:** `rg -n "ersId" contexts screens lib infra project shared`
```txt
(no matches)
```
