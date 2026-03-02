# 07 — Diagnostics → Fix Playbook (Buildflow wasserdicht)

Stand: 2026-03-01 (Europe/Berlin)

Dieses Dokument verbindet **alle existierenden Diagnostic Checks** mit den **Build-Readiness Items** aus `docs/06-build-readiness.md` und liefert pro Check einen **Fix-Pfad** (AutoFix vs. Manual) inkl. “Was danach erneut prüfen”.

> Scope:
> - *Local Preflight Checks* (in-app, auf `project.files`)
> - *Pipeline Checks* (GitHub Repo/Branch & Secrets)
> - *CI AutoFix* (Workflows + .gitignore + Secret-Sync Hooks)

---

## 1) Wo kommen Diagnostics her?

### 1.1 Local Preflight (Project Files / In-App)
Runner: `lib/diagnostics/preflightRunner.ts` + `lib/diagnostics/preflightChecks.ts`  
Checks sind in Modulen unter `lib/diagnostics/checks/*` definiert.

Ausführung über UI: **Diagnostic Screen → “Scannen”**  
Fix-Ausführung über UI: **Issue Detail → “Auto-Fix”** oder **“Fixen” (Smart Fix)**.

### 1.2 Pipeline Diagnostics (GitHub/EAS Repo-Side)
Runner: `lib/diagnostics/buildPipelineDiagnostics.ts` (über `screens/DiagnosticScreen/hooks/diagnosticRunners.ts`)

Ausführung über UI: **Diagnostic Screen → Scannen** (wenn Repo verknüpft)

### 1.3 CI AutoFix (Workflows / .gitignore / Secret names)
Implementation: `lib/diagnostics/ciAutoFix.ts` + `lib/autoSyncRepoSecrets.ts`

UI Entry Points (aus Code ersichtlich, Bezeichnungen können leicht abweichen):
- **Repo Screen**: “CI Workflows fixen / Sync Workflows”
- **Repo/Secrets**: “Secrets syncen”

---

## 2) Inventory: Alle Checks (ID → Title → Bedingungen)

> Notation:  
> - **Status**: fail/warn/pass/info  
> - **Ziel**: Local (Preflight) vs Pipeline vs CI AutoFix  
> - **Build-Readiness Item**: Referenz auf Matrix aus `docs/06-build-readiness.md`

### 2.1 Local Preflight Checks (project.files)

| Check-ID | Title | Severity | Fail/Warn Bedingung (kurz) |
|---|---|---:|---|
| `core-package-json` | package.json vorhanden | critical | **fail** wenn `package.json` fehlt oder keine valide JSON |
| `entry-point` | Entry-Point / main vorhanden | high | **fail** wenn `main`/`index.js`/`App.*` fehlt |
| `expo-config-validation` | Expo Config Validation | high | **fail** wenn keine `app.json`/`app.config.js`; **fail** bei invalid JSON; **warn** bei missing required fields |
| `eas-profiles` | EAS Profile Android (APK vs AAB) | normal | (nur EAS) **warn** wenn `eas.json` fehlt / Profil fehlt / buildType unset; **fail** wenn buildType != `apk` |
| `expo-sdk-consistency` | Expo SDK Konsistenz (light) | low | **warn** wenn `expo` oder `react-native` dep fehlt oder Kombi “wirkt ungewöhnlich” |
| `assets-exist` | Assets referenced existieren | normal | **warn** wenn in Config referenzierte Asset-Dateien fehlen |
| `lockfile-consistency` | Lockfile Konsistenz | normal | **warn** wenn kein Lockfile und kein `.npmrc package-lock=true`; **warn** wenn mehrere Lockfiles |
| `gitignore-present` | .gitignore vorhanden | normal | **fail** wenn `.gitignore` fehlt; **warn** wenn typische Einträge fehlen |
| `security-forbidden-files` | Security: verbotene/gefährliche Dateien | high | **fail** wenn `.jks`/`keystore` oder Private-Key Marker gefunden oder riesige Inhalte |
| `native-dirs-managed-guard` | Native Ordner Konsistenz (Android-only) | normal | **warn** wenn `android/` oder `ios/` “halb da” (gradle/Podfile fehlt) |
| `eas-withoutcredentials-debug` | EAS Debug Builds ohne Keystore | normal | **warn** wenn `build.development` / `build.preview` kein `android.withoutCredentials=true` |
| `rn-react-compat` | React / React Native Kompatibilität | high | **fail** bei `react>=18.3` und RN `<0.75` (heuristic) |
| `quality-scripts` | Quality Scripts: TS/ESLint Dependencies | normal | **warn** wenn scripts `tsc`/`eslint` enthalten aber deps fehlen |
| `security-workflow-service-role-key` | Security: Service Role Key Leak in Workflows | high | **fail** wenn Workflow YAML hardcoded `*_SERVICE_ROLE_*` value “secret-like” |
| `workflow-yaml-name-colon-quoting` | Workflow YAML: quote names containing ': ' | critical | **fail** wenn Workflow/Step `name:` unquoted und `": "` enthält (YAML Pitfall) |

### 2.2 Pipeline Checks (GitHub Repo/Branch/Secrets)

| Check-ID | Title | Status-Regel (kurz) |
|---|---|---|
| `local.githubToken` | GitHub Token vorhanden | fail wenn Token leer |
| `local.expoToken` | Expo Token vorhanden | fail wenn Token leer |
| `local.edgeAdminKey` | Edge Admin-Key vorhanden | warn wenn leer (nicht blocker für Build) |
| `repo.expoConfig` | Expo Config vorhanden (app.config.* / app.json) | fail wenn none |
| `repo.easJson` | eas.json vorhanden | fail wenn fehlt |
| `repo.easJson.parse` | eas.json ist parsebar | fail wenn parse/read error |
| `repo.easProfile.development|preview|production` | EAS Profil vorhanden | fail wenn Profil fehlt |
| `repo.easBuildType.<profile>` | Android BuildType (APK-only) | warn wenn unset, fail wenn != apk; bietet Fix |
| `repo.easAndroidWithoutCreds.development|preview` | Android Signierung (CI-safe) | warn wenn withoutCreds fehlt; Fix vorhanden |
| `repo.easAndroidWithoutCreds.production` | Android Signierung (production) | warn wenn `withoutCredentials=true`; Fix vorhanden |
| `repo.easDevelopmentCoherent` | Development Profil konsistent | warn wenn `developmentClient=false` aber distribution != internal; Fix vorhanden |
| `repo.easEnableDevClientFlow` | Optional: Development-Client Flow aktivieren | info (kein blocker) |
| `repo.dep.expoDevClient` | Dependency: expo-dev-client | warn wenn developmentClient=true aber dep fehlt; Fix bietet “switch to internal APK” |
| `repo.dep.expoDevClient.read` | expo-dev-client read | warn wenn package.json nicht lesbar |
| `repo.easProjectId` | EAS projectId vorhanden (non-interactive) | fail wenn projectId nicht in eas-project.json/app.json/app.config gefunden |
| `repo.workflow.easLink` | Workflow vorhanden: eas-link.yml | fail wenn fehlt |
| `repo.workflow.triggeredBuild` | Workflow vorhanden: k1w1-triggered-build.yml | fail wenn fehlt |
| `repo.secret.expoToken` | Repo Secret vorhanden: EXPO_TOKEN | fail wenn fehlt |
| `repo.secret.supabaseUrl` | Repo Secret vorhanden: SUPABASE_URL | warn wenn fehlt |
| `repo.secret.supabaseServiceRole` | Repo Secret vorhanden: SUPABASE_SERVICE_ROLE_KEY | warn wenn fehlt |
| `repo.secret.list` | Repo Secrets abrufbar | warn wenn API call fail (permission) |
| `repo.appConfig.usesEasProjectJson` | app.config.js nutzt eas-project.json | warn wenn app.config.js eas-project.json nicht referenziert |

---

## 3) Mapping: Checks → Build-Readiness Items (docs/06)

Build-Readiness Items (Kurz):
- **BR-1 Repo/Branch gewählt**
- **BR-2 Build-Profil gültig**
- **BR-3 Tokens vorhanden (GitHub+Expo)**
- **BR-4 Diagnostics grün (`DIAGNOSTIC_LAST_OK`)**
- **BR-5 Signing-Key Status (profilbezogen)**
- **BR-6 Workflows vorhanden**
- **BR-7 EAS Profile korrekt (apk/withoutCredentials/production signing)**
- **BR-8 Secrets in GitHub (EXPO_TOKEN + prod Supabase)**
- **BR-9 EAS Project Linking (projectId / eas-project.json)**
- **BR-10 Project files exist (Projekt nicht leer)**

| Check-ID | Build-Readiness Item(s) | Gate-Level |
|---|---|---|
| `local.githubToken`, `local.expoToken` | BR-3 | **Blocker** |
| `repo.secret.expoToken` | BR-8 | **Blocker** |
| `repo.secret.supabaseUrl`, `repo.secret.supabaseServiceRole` | BR-8 | **Warn (dev/preview)** / **Blocker (prod, per Workflow)** |
| `repo.workflow.easLink`, `repo.workflow.triggeredBuild` | BR-6 | **Blocker** |
| `repo.easJson`, `repo.easJson.parse`, `repo.easProfile.*` | BR-7 | **Blocker** |
| `repo.easBuildType.*` | BR-7 | warn/fail abhängig |
| `repo.easAndroidWithoutCreds.*` | BR-7 | warn |
| `repo.easProjectId` | BR-9 | **Blocker** (non-interactive) |
| `repo.expoConfig` / `expo-config-validation` | BR-10 (indirekt: Buildbares Projekt) | **Blocker** |
| `core-package-json`, `entry-point` | BR-10 | **Blocker** |
| `lockfile-consistency`, `gitignore-present` | BR-10 (stability) | warn/fail |
| `security-forbidden-files` | BR-10 (security) | **Blocker** |
| `native-dirs-managed-guard` | BR-10 | warn |
| `eas-withoutcredentials-debug`, `eas-profiles` | BR-7 | warn/fail |
| `workflow-yaml-name-colon-quoting`, `security-workflow-service-role-key` | BR-6/BR-8 | **Blocker** |
| `repo.appConfig.usesEasProjectJson` | BR-9 | warn |
| `local.edgeAdminKey`, `repo.secret.list` | (remote reporting) | warn |

---

## 4) Diagnostics → Fix Playbook (wichtigste Tabelle)

**Spalten-Definitionen**
- **Blocker?**: Muss für Build “grün” sein (in Service Gate)  
- **AutoFix?**: Ist in Diagnose-Result ein Patch/Fix vorhanden ODER existiert ein dedizierter Button/Flow?  
- **AutoFix Action**: Konkreter UI/Code Entry Point (Screen/Button/Funktion)  
- **Manual Steps**: Wenn kein AutoFix oder wenn Tokens/Permissions fehlen  
- **Re-Check**: Welche Checks danach erneut laufen müssen

### 4.1 Playbook (Local Preflight)

| Check-ID | Fail/Warn | Ursache | Blocker? | AutoFix? | AutoFix Action (konkret) | Manual Steps | Re-Check |
|---|---|---|---:|---:|---|---|---|
| `core-package-json` | fail | package.json fehlt/invalid | ✅ | ✅ | Diagnostic Screen → Issue → **Auto-Fix** (legt package.json Starter an) | package.json anlegen/validieren | `core-package-json`, `lockfile-consistency`, `quality-scripts`, `expo-sdk-consistency` |
| `entry-point` | fail | kein index/App/main | ✅ | ✅ | Auto-Fix (legt `index.js` stub + setzt `package.json.main`) | `index.js` erstellen & `main` korrekt setzen | `entry-point` + ggf. `expo-config-validation` |
| `expo-config-validation` | fail/warn | app.json/app.config fehlt/invalid/unvollständig | ✅ (fail) / ❌ (warn) | ✅ (fail) / ❌ (warn) | Auto-Fix „Create minimal app.json“ (nur wenn app.json + app.config.js fehlen) | app.json/app.config manuell vervollständigen; Placeholder anpassen | `expo-config-validation`, `assets-exist` |
| `eas-profiles` | warn/fail | eas.json fehlt oder falscher buildType | ⚠️ (target=EAS) | ✅ (teilweise) | Auto-Fix für buildType; falls eas.json fehlt: Patch Template | eas.json manuell erstellen/Profiles ergänzen | `eas-profiles`, `eas-withoutcredentials-debug` |
| `eas-withoutcredentials-debug` | warn | dev/preview ohne withoutCredentials | ⚠️ (CI stability) | ✅ | Auto-Fix (jsonMerge setzt withoutCredentials) | eas.json → build.development/preview.android.withoutCredentials=true | `eas-withoutcredentials-debug`, `repo.easAndroidWithoutCreds.*` |
| `lockfile-consistency` | warn | kein Lockfile / mehrere Lockfiles | ❌ (meist) | ✅ | Auto-Fix (erstellt/patcht `.npmrc`, löscht extra Lockfiles) | 1 Package-Manager wählen; Lockfile commiten | `lockfile-consistency` |
| `gitignore-present` | fail/warn | .gitignore fehlt oder unvollständig | ❌ | ✅ | Auto-Fix (Template / Append missing entries) | .gitignore ergänzen | `gitignore-present` |
| `assets-exist` | warn | Asset-Refs zeigen auf fehlende Dateien | ❌ | ❌ | — | Fehlende Assets hinzufügen oder Config refs korrigieren | `assets-exist` |
| `native-dirs-managed-guard` | warn | android/ios halbfertig im repo | ⚠️ | ❌ | — | Halb-Ordner entfernen oder komplettieren (android/app/build.gradle, ios/Podfile) | `native-dirs-managed-guard` |
| `security-forbidden-files` | fail | Keystore/PrivateKey/hard secrets im Source | ✅ | ❌ | — | Entfernen + `.gitignore` + Git history bereinigen; Secrets rotieren | `security-forbidden-files` + Security review |
| `rn-react-compat` | fail | react/rn mismatch (heuristic) | ✅ | ❌ | — | Versionset nach Expo SDK kompatibel setzen (Expo SDK docs) | `rn-react-compat`, `expo-sdk-consistency` |
| `quality-scripts` | warn | scripts vorhanden, deps fehlen | ❌ | ✅ | Auto-Fix (fügt devDeps `typescript`/`eslint` mit `*` hinzu) | Versions pinnen, `npm i` | `quality-scripts`, `typecheck`, `lint` |
| `expo-sdk-consistency` | warn | expo/rn missing/weird | ❌ | ❌ | — | Abgleich Expo SDK ↔ RN ↔ React | `expo-sdk-consistency`, `rn-react-compat` |
| `security-workflow-service-role-key` | fail | hardcoded service role in workflows | ✅ | ✅ (safe-only) | Safe Assist: ersetzt nur exakte Zeile `SUPABASE_SERVICE_ROLE_KEY: "..."` durch `${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}` | Bei nicht eindeutigem Match: manuell ersetzen + Keys rotieren | `security-workflow-service-role-key` |
| `workflow-yaml-name-colon-quoting` | fail | YAML name mit `: ` unquoted | ✅ | ✅ | Auto-Fix: quote `name:` values in `.github/workflows/*` | Manuell quotes setzen | `workflow-yaml-name-colon-quoting` |

### 4.2 Playbook (Pipeline Checks)

| Check-ID | Fail/Warn | Ursache | Blocker? | AutoFix? | AutoFix Action (konkret) | Manual Steps | Re-Check |
|---|---|---|---:|---:|---|---|---|
| `local.githubToken` | fail | GitHub Token fehlt | ✅ | ❌ | — | Connections → GitHub Token speichern | Pipeline run |
| `local.expoToken` | fail | Expo Token fehlt | ✅ | ❌ | — | Connections → Expo Token speichern | Pipeline run |
| `repo.secret.expoToken` | fail | GitHub Secret EXPO_TOKEN fehlt | ✅ | ✅ | Repo/Secrets → **Secrets syncen** (`autoSyncRepoSecrets`) | GitHub Repo Settings → Secrets → Actions → EXPO_TOKEN setzen | `repo.secret.expoToken` + Workflow validate |
| `repo.secret.supabaseUrl` | warn | SUPABASE_URL fehlt | ⚠️ (prod) | ✅ | Secrets syncen (wenn lokal vorhanden) | GitHub Secret setzen (prod Pflicht per Workflow) | `repo.secret.supabaseUrl` |
| `repo.secret.supabaseServiceRole` | warn | SERVICE_ROLE fehlt | ⚠️ (prod) | ✅ | Secrets syncen (wenn lokal vorhanden) | GitHub Secret setzen (prod Pflicht per Workflow) | `repo.secret.supabaseServiceRole` |
| `repo.secret.list` | warn | Token darf Secrets nicht lesen | ⚠️ | ❌ | — | Token scopes/permissions fixen (Repo admin / fine-grained “Actions secrets: read”) | Pipeline run |
| `repo.workflow.easLink` | fail | Workflow fehlt | ✅ | ✅ | Repo Screen → **CI Workflows fixen** (`autoFixCIWorkflows`) | Datei manuell in `.github/workflows/` hinzufügen & commit | `repo.workflow.easLink`, `workflow-yaml-name-colon-quoting` |
| `repo.workflow.triggeredBuild` | fail | Workflow fehlt | ✅ | ✅ | CI Workflows fixen | Manuell hinzufügen | `repo.workflow.triggeredBuild` |
| `repo.easJson` | fail | eas.json fehlt | ✅ | ✅ | Auto-Fix „Apply canonical EAS config“ (upsert canonical eas.json) | — | `repo.easJson`, `repo.easProfile.*` |
| `repo.easJson.parse` | fail | eas.json kaputt | ✅ | ❌ | — | eas.json reparieren (valid JSON) | `repo.easJson.parse` |
| `repo.easProfile.<p>` | fail | build.<p> fehlt | ✅ | ✅ | Auto-Fix „Apply canonical EAS config“ (additiver jsonMerge für fehlendes Profil) | eas.json manuell ergänzen (optional) | `repo.easProfile.<p>` |
| `repo.easBuildType.<p>` | warn/fail | buildType unset/!=apk | ✅ (fail) | ✅ | Auto-Fix (jsonMerge buildType=apk) | eas.json fixen | `repo.easBuildType.<p>` |
| `repo.easAndroidWithoutCreds.development|preview` | warn | withoutCredentials fehlt | ⚠️ | ✅ | Auto-Fix (jsonMerge withoutCredentials=true) | eas.json fixen | `repo.easAndroidWithoutCreds.*` |
| `repo.easAndroidWithoutCreds.production` | warn | production w/out creds | ⚠️ | ✅ | Auto-Fix (jsonMerge false) | eas.json fixen | `repo.easAndroidWithoutCreds.production` |
| `repo.easDevelopmentCoherent` | warn | distribution nicht internal | ❌ | ✅ | Auto-Fix distribution=internal | eas.json fixen | `repo.easDevelopmentCoherent` |
| `repo.dep.expoDevClient` | warn | dev-client flow ohne dep | ❌ | ✅ | Auto-Fix (switch to internal APK) | package.json deps ergänzen ODER dev-client aus | `repo.dep.expoDevClient` |
| `repo.easProjectId` | fail | projectId fehlt | ✅ | ✅ | Auto-Fix „EAS Projekt verbinden (Auto)“ (workflow dispatch `eas-link.yml`, mit bootstrap fallback) | Manuell Repo Screen Link-Flow | `repo.easProjectId`, `repo.workflow.easLink` |
| `repo.appConfig.usesEasProjectJson` | warn | app.config.js nutzt eas-project.json nicht | ❌ | ❌ | — | app.config.js anpassen (projectId aus eas-project.json lesen) | `repo.appConfig.usesEasProjectJson` |
| `repo.expoConfig` | fail | app.json/app.config fehlt | ✅ | ✅ | Auto-Fix „Create minimal Expo config“ (`app.json` placeholders) | Placeholder auf echte Werte setzen | `repo.expoConfig` |

---

## 5) Gaps: Blocker ohne Fix-Möglichkeit → Vorschläge

### 5.1 Blocker ohne AutoFix (sollte es geben)
1) **`repo.easProjectId` (FAIL)**  
   - Problem: Check ist Blocker, aber hat keinen AutoFix-Patch.  
   - **Vorschlag AutoFix Action (UI)**:  
     - Button: “EAS Link ausführen”  
     - Action: `triggerWorkflow(owner, repo, "eas-link.yml", { inputs: { profile: "development", EAS_PROJECT_ID_INPUT?: <optional> }})` *oder* direkt “RepoScreen link flow” (falls existiert).  
   - **Nachlauf**: `repo.easProjectId`, `repo.workflow.easLink`, optional `repo.appConfig.usesEasProjectJson`.

2) **`repo.easJson` / `repo.easProfile.<p>` (FAIL)**  
   - Pipeline erkennt fehlende Profiles, aber Fix ist “manuell”.  
   - **Vorschlag**: “Apply canonical eas.json” AutoFix (jsonMerge oder full upsert).  
   - Dazu: `buildPipelineDiagnostics` kann bei `repo.easJson` ein Fix anbieten (Template upsert).

3) **`expo-config-validation` (FAIL)**  
   - **Vorschlag**: AutoFix “Minimal app.json” (name/slug/version/android.package placeholder).  
   - Wichtig: android.package muss unique sein → default `com.example.app` + UI zwingt user to edit.

4) **`security-workflow-service-role-key` (FAIL)**  
   - AutoFix ist absichtlich konservativ (gut).  
   - **Vorschlag**: “Safe Assist Fix”: ersetzt nur **eindeutig** hardcoded Werte durch `${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}` *wenn* KEY name genau passt und line single-scalar ist.  
   - Zusätzlich: **Warn-Modal**: “Keys rotieren”.

### 5.2 Manual Steps schärfen (DX)
- Für `repo.secret.list` klarer: “Dein GitHub Token ist zu schwach: benötigte Permission = Actions secrets read / repo admin. Ohne das kann Diagnose nicht verifizieren, Build kann trotzdem später failen.”
- Für `security-forbidden-files`: Kurz-Runbook (remove + rotate + history rewrite).

---

## 6) “Buildflow startbar” – Minimaler Green Path

**Wenn du NUR starten willst (dev/preview):**
1) Repo/Branch gesetzt (SoT, kein Fallback)
2) Tokens: GitHub + Expo vorhanden
3) Diagnostic run → **keine FAILs** bei:
   - `core-package-json`, `entry-point`, `expo-config-validation`, `security-forbidden-files`
4) Repo hat:
   - `.github/workflows/eas-link.yml`, `k1w1-triggered-build.yml`, `eas-build.yml`, `release-build.yml` (via CI AutoFix)
   - `EXPO_TOKEN` Secret
   - `eas.json` mit `build.development` & `build.preview` (APK, withoutCredentials=true empfohlen)
   - `eas-project.json` (projectId) oder equivalent.

Dann: Build Start Gate ist stabil.


---

## 7) Error-Codes (stabil für Tests/Telemetry)

Build-Readiness nutzt jetzt stabile Code-Präfixe (zusätzlich zur UX-Message):
- `BRANCH_MISSING`
- `DIAGNOSTIC_NOT_GREEN`

Hinweis: UI kann weiterhin menschenlesbare Texte anzeigen; Tests sollten bevorzugt auf Code-Präfixe assertieren.
