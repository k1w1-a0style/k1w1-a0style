# 08 — Test Coverage Matrix (Build Readiness + Diagnostics)

Stand: 2026-03-01

Ziel: Die **Build Readiness Gate** Regeln (docs/06) und die **Diagnostics/Fix-Mechanik** so abdecken, dass:
- ein Build **nicht** “still” mit Defaults läuft,
- **jede** Warnung/Fehlermeldung einen klaren Fix-Pfad hat,
- AutoFix-Patches korrekt angewendet werden (jsonMerge/upsert/delete),
- Pipeline-Checks sauber gemockt sind.

> Hinweis: Es existieren bereits ~40+ Jest/RNTL Tests.  
> Ohne vollständigen Repo-Testindex kann ich bestehende Tests nicht 1:1 referenzieren.  
> Deshalb ist die Matrix zweigeteilt:
> 1) **Must-have Invarianten** (Gate/Diagnostics)  
> 2) **Empfohlene neue Tests** (max 20, High/Med)

---

## 1) Coverage Matrix (Invarianten → Tests)

Legende:
- **Prio**: High = verhindert Build-Blocker/Regression; Med = DX/Stability.
- **Vorhanden**: “?” = bitte gegen deinen Testbaum mappen (sollte schnell gehen, viele Tests existieren schon).

| Build-Readiness Item / Invariante | Erwartung | Vorhandener Test | Fehlt | Prio |
|---|---|---|---:|---:|
| BR-1 Repo valid | `validateRepoFullName(owner/repo).valid === true` sonst Gate blockt | ? | ✅ | High |
| BR-1 Branch gesetzt | branchName muss non-empty; Service darf nicht auf defaultBranch/main “durchfallen” | ? | ✅ | High |
| BR-2 Profil valid | Nur `development|preview|production` | ? | ✅ | High |
| BR-3 Tokens | GH+Expo Token müssen vorhanden sein (UI + Service) | ? | ✅ | High |
| BR-4 Diagnostics grün | `STORAGE_KEYS.DIAGNOSTIC_LAST_OK === "true"` sonst Blocker | ? | ✅ | High |
| BR-5 Signing status | `CRED_KEY_EXISTS_* === "true"` pro Profil (Wizard persistiert) | ? | ✅ | Med |
| BR-6 Workflows vorhanden | CI AutoFix schreibt Soll-Workflows in `.github/workflows/*` | ? | ✅ | High |
| BR-7 eas.json Profiles | `build.<profile>` existiert, buildType=apk, withoutCredentials rules | ? | ✅ | High |
| BR-8 Secrets | EXPO_TOKEN (required), Supabase secrets required in prod | ? | ✅ | High |
| BR-9 EAS Project ID | projectId muss auffindbar (eas-project.json/app.json/app.config) | ? | ✅ | High |
| BR-10 Project files | `project.files.length > 0` + entrypoint present | ? | ✅ | High |
| Patch apply correctness | jsonMerge merges minimal keys, upsert replaces, delete removes | ? | ✅ | High |
| Pipeline diagnostics mapping | `DiagnosticCheck` → `PreflightCheckResult` mapping korrekt (status/severity/fix) | ? | ✅ | Med |

---

## 2) Neue Tests (15–20) – Vorschläge (High/Med)

### 2.1 Gate / Build Start Service (High)

1) **assertBuildReadiness blocks repo fallback**
- **Target**: `project/services/buildStartService.ts::startBuildJob` (oder neue `assertBuildReadiness`)
- **Setup**: project.linkedRepo = "" + CONFIG.BUILD.GITHUB_REPO gesetzt  
- **Assert**: throws mit “Repo fehlt/ungültig”, *bevor* `bestEffortPushToGitHub` call.
- **Mocks**: mock `bestEffortPushToGitHub` and assert not called.

2) **assertBuildReadiness blocks branch fallback**
- project.linkedBranch = ""  
- mock `getDefaultBranch` to return `main`
- **Assert**: throws “Branch fehlt”; `getDefaultBranch` NOT called.

3) **assertBuildReadiness blocks on DIAGNOSTIC_LAST_OK !== "true"**
- mock AsyncStorage getItem returns "false"/null
- **Assert**: throws; also verify error message stable.

4) **Tokens required (GitHub + Expo)**
- mock token getters to return ""  
- **Assert**: throws; build not started.

5) **Profile normalization does NOT downgrade invalid profile to development**
- pass buildProfile="dev" or "prod"  
- **Assert**: throws invalid profile (no silent normalize).  
  (Wenn normalizeProfile existiert: Test muss erzwingen, dass Gate davor greift.)

### 2.2 Pipeline Diagnostics (High/Med)

6) **runBuildPipelineDiagnostics emits fail for missing EXPO_TOKEN secret**
- mock `listRepoSecretNames` to return []  
- **Assert**: check `repo.secret.expoToken` status fail.

7) **EAS projectId detection priority order**
- Provide three cases: `eas-project.json`, `app.json expo.extra.eas.projectId`, `app.config.js text contains UUID`.
- **Assert**: status pass and details include source.

8) **Workflows existence checks**
- mock `fileExists` for `.github/workflows/eas-link.yml` false  
- **Assert**: `repo.workflow.easLink` fail.

9) **eas.json parse fail produces repo.easJson.parse fail**
- mock `getRepoFileText` returns invalid JSON for eas.json  
- **Assert**: includes `repo.easJson.parse` fail.

10) **Fix patch is present when buildType unset**
- eas.json has build.preview.android={} (no buildType)  
- **Assert**: check `repo.easBuildType.preview` warn + has fix.patch.jsonMerge.

### 2.3 Local Preflight Checks (High/Med)

11) **checkWorkflowYamlNameColonQuoting auto-fixes**
- Provide workflow file content with `name: Foo: Bar` (unquoted)  
- **Assert**: status fail + patch.upsert contains quoted `name: "Foo: Bar"`.

12) **checkLockfileConsistency prefers single lockfile and deletes extras**
- Provide package-lock + yarn.lock  
- **Assert**: warn + patch.delete includes one of them.

13) **checkEasWithoutCredentialsForDebug produces jsonMerge for missing keys**
- eas.json missing withoutCredentials  
- **Assert**: warn + patch.jsonMerge has both dev+preview.

14) **checkForbiddenFiles flags keystore path**
- Add file path `android/app/release.keystore`  
- **Assert**: fail + details include path.

15) **checkEntryPoint auto-fix writes index.js and sets main**
- Missing entry files; package.json exists with main="src/index.js"  
- **Assert**: fail + patch includes `index.js` upsert and `package.json` jsonMerge main="index.js".

### 2.4 Patch Apply Engine (High)

16) **applyPreflightPatch jsonMerge merges without overwriting sibling keys**
- existing eas.json build.preview.android.buildType="apk", plus other keys  
- patch merges withoutCredentials=true  
- **Assert**: buildType remains.

17) **applyPreflightPatch delete removes files**
- start with files contains `yarn.lock`  
- apply patch.delete includes yarn.lock  
- **Assert**: file removed.

18) **applyPreflightPatch upsert overwrites**
- file exists with old content; upsert new content  
- **Assert**: exact replace.

### 2.5 UI glue (Med)

19) **DiagnosticScreen sorts fail before warn before pass**
- Provide results in mixed order  
- **Assert**: rendered order stable (fail first).

20) **SmartFix only targets fixable results**
- Provide results with and without `fix.patch`  
- **Assert**: applyIssueFix called only for fixable.

---

## 3) Bonus: 5–10 Invariant String Tests (Regression/Hardcoding Guard)

Ziel: verhindern, dass jemand “aus Versehen” Defaults/hardcodes reintroduziert.

1) **No silent repo fallback**
- Assert `buildStartService.ts` does not reference `CONFIG.BUILD.GITHUB_REPO` in final start path *ohne Gate*.
- (String test: grep-like read module source in test.)

2) **No silent branch fallback to 'main' without gate**
- Assert string `"fallback auf 'main'"` is only in bestEffort helper and gate blocks empty branch.

3) **Secrets keys are exact**
- `EXPO_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` are exact constants (no typos).
- (Test that REQUIRED_SECRETS equals ["EXPO_TOKEN"].)

4) **AsyncStorage keys exact**
- `STORAGE_KEYS.DIAGNOSTIC_LAST_OK` exact.

5) **Workflow filenames canonical**
- WORKFLOWS keys are exactly:
  - `k1w1-triggered-build.yml`, `eas-build.yml`, `release-build.yml`, `eas-link.yml`

6) **EAS build profiles canonical**
- profiles array is exactly `["development","preview","production"]`.

7) **APK-only policy constant**
- Ensure `buildType` patch always sets `"apk"`.

8) **Production credentialsSource local**
- If there is a canonical eas.json template in code: assert `credentialsSource: "local"` only in production.

9) **No service-role literal patterns**
- Ensure no `SERVICE_ROLE_KEY` literal > 40 chars appears in workflows templates.

10) **Workflow Validate inputs strings stable**
- keep `Missing GitHub Secret EXPO_TOKEN` message stable to match gating.


---

## Update 2026-03-01 (Phase 4: Testability DX)

- Testability exports ergänzt:
  - `assertBuildReadiness(project, deps?)` mit optionalem `storageGetItem`-DI
  - `runBuildPipelineDiagnostics(params, deps?)` mit optionalen Service-Dependencies
  - `runPreflightChecks` Alias + `PRECHECKS_REGISTRY` + `getPreflightCheckById`
  - `applyPatch` als kanonische Patch-Engine-Entry-Function (Alias: `applyPreflightPatch`)
  - stabile Build-Readiness Error-Codes (`BRANCH_MISSING`, `DIAGNOSTIC_NOT_GREEN`)
- Neue Med-Tests ergänzt:
  - Diagnostics-UI Sortierung (`fail > warn > pass`)
  - SmartFix wendet nur wirklich fixbare Issues an
  - Runner-Resilience: einzelner throwender Check crasht den Gesamtscan nicht

## Update 2026-03-02 (Phase 5 P0 AutoFix)

Neu abgedeckt (High):
- `repo.easProjectId` FAIL liefert jetzt Workflow-Dispatch Fix-Metadaten (`eas-link.yml`).
- `repo.easJson` FAIL liefert canonical upsert fix.
- `repo.easProfile.*` FAIL liefert additive jsonMerge fix.
- `expo-config-validation` FAIL liefert minimal `app.json` AutoFix.
- `security-workflow-service-role-key` Safe Assist (strict pattern) mit Test für exact/non-exact Fälle.
- Canonical eas-json Merge bewahrt vorhandene Sibling-Keys.

---

## 3) Abdeckung ergänzt: E2E Smoke Buildflow (Phase 6/7)

Neue direkte Coverage:
- Fixture-basierter End-to-End Diagnosefluss: kaputt → Diagnose → AutoFix → Re-Scan → Gate-Simulation grün.
- Pipeline-Secret-Check (`repo.secret.expoToken`) in isolierter Offline-Simulation.
- Workflow YAML Colon Quoting AutoFix in realer Fixture-Datei.
- Runner-Resilience: ein throwender Check blockiert keine Folgeläufe.
- Stabiler Diagnostics-Schema-Snapshot (`id/status/severity` only).

Neue Testdateien:
- `__tests__/e2e.smoke.buildflow.test.ts`
- `__tests__/e2e.smoke.diagnosticsResilience.test.ts`
- `__tests__/e2e.smoke.diagnosticsSchemaSnapshot.test.ts`
- `__tests__/helpers/testDeps.ts` (deterministische Mock-Factorys)
