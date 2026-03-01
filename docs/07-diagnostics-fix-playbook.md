# 07 — Diagnostics → Fix Playbook (Build-Readiness)

## Ziel
Für jede relevante Diagnostic-Meldung ist eindeutig geklärt:
- Blocker vs Warnung
- AutoFix vorhanden oder nicht
- konkreter AutoFix-Auslöser (Funktion/Button/Screen)
- Manual Steps
- Re-Check nach dem Fix

Basis: `docs/06-build-readiness.md`, `lib/diagnostics/buildPipelineDiagnostics.ts`, `lib/diagnostics/preflightChecks.ts`.

## Diagnostic-Inventar (kompakt)

### Pipeline Checks
`local.githubToken`, `local.expoToken`, `local.edgeAdminKey`, `repo.expoConfig`, `repo.easJson`, `repo.easJson.parse`, `repo.easProfile.{development|preview|production}`, `repo.easBuildType.{profile}`, `repo.easAndroidWithoutCreds.{profile}`, `repo.easDevelopmentCoherent`, `repo.dep.expoDevClient`, `repo.easProjectId`, `repo.workflow.easLink`, `repo.workflow.triggeredBuild`, `repo.secret.expoToken`, `repo.secret.supabaseUrl`, `repo.secret.supabaseServiceRole`, `repo.secret.list`, `repo.appConfig.usesEasProjectJson`.

### Local Preflight Checks
`core-package-json`, `gitignore-present`, `lockfile-consistency`, `entry-point`, `expo-config-validation`, `assets-exist`, `native-dirs-managed-guard`, `eas-withoutcredentials-debug`, `quality-scripts`, `eas-profiles`, `expo-sdk-consistency`, `rn-react-compat`, `security-workflow-service-role-key`, `workflow-yaml-name-colon-quoting`, `security-forbidden-files`.

## Diagnostics → Fix Playbook

| Check-ID | Fail/Warn | Ursache | Blocker? | AutoFix? | AutoFix Action (konkret) | Manual Steps | Re-Check |
|---|---|---|---|---|---|---|---|
| `local.githubToken` | fail | GitHub Token lokal fehlt | Ja | Nein | — | Connections: GitHub Token speichern | Full diagnostics + Buildstart |
| `local.expoToken` | fail | Expo Token lokal fehlt | Ja | Teilweise | Secret-Sync nutzt lokalen Token | Connections: Expo Token setzen | `repo.secret.expoToken` |
| `repo.secret.expoToken` | fail | Repo Secret fehlt | Ja | Ja | One-Click Deploy / Secretsync (`autoSyncRepoSecrets`) | ggf. manuell in GitHub setzen | Pipeline rerun |
| `repo.expoConfig` | fail | app config fehlt | Ja | Nein | — | `app.json` oder `app.config.js/ts` erstellen | Local rerun |
| `repo.easJson` / `.parse` | fail | `eas.json` fehlt/kaputt | Ja | Teilweise | Issue-Fix Patch (`useDiagnosticFixRunner`) | JSON manuell korrigieren | `eas-profiles` |
| `repo.easProfile.*` | fail | Profil fehlt | Ja | Ja | Issue-Fix (`jsonMerge` eas.json) | Profil-Policy prüfen | Pipeline rerun |
| `repo.easBuildType.*` | fail/warn | `apk` policy verletzt | Ja bei fail | Ja | Issue-Fix „buildType=apk“ | — | Pipeline rerun |
| `repo.easAndroidWithoutCreds.development/preview` | warn | CI-safe Flag fehlt | Indirekter Blocker | Ja | Issue-Fix setzt `withoutCredentials=true` | alternativ Keystore bereitstellen | Build smoke |
| `repo.easAndroidWithoutCreds.production` | warn | prod ohneCredentials=true | Ja | Ja | Issue-Fix setzt false | prod signing sicherstellen | production rerun |
| `repo.easProjectId` | fail | projectId fehlt | Ja | Teilweise | `eas-link.yml` Workflow triggern | ggf. `eas project:init` + commit | `repo.easProjectId` |
| `repo.workflow.easLink` / `triggeredBuild` | fail | Workflow fehlt | Ja | Ja | Diagnostic CI AutoFix Button (`runCiAutofix`) | manuell commit bei fehlenden Rechten | Pipeline rerun |
| `repo.secret.supabaseUrl` / `repo.secret.supabaseServiceRole` | warn | Prod secrets fehlen | Ja für prod | Teilweise | best-effort sync wenn lokal vorhanden | manuell GitHub Secrets setzen | Prod workflow validate |
| `core-package-json` | fail | package.json fehlt/invalid | Ja | Ja | Issue-Fix erzeugt package.json | Inhalte validieren | Local rerun |
| `entry-point` | fail | Entry fehlt | Ja | Ja | Issue-Fix: index.js + main | App-Importpfad prüfen | Local rerun |
| `expo-config-validation` | fail/warn | app config unvollständig | Ja bei fail | Nein | — | fehlende Felder ergänzen | Local rerun |
| `gitignore-present` | fail/warn | .gitignore fehlt/lückenhaft | Nein | Ja | Issue-Fix erzeugt/ergänzt .gitignore | — | Local rerun |
| `lockfile-consistency` | warn | kein/mehrere Lockfiles | Nein | Ja | Issue-Fix `.npmrc`/Delete lockfiles | PM konsolidieren | install + rerun |
| `eas-withoutcredentials-debug` | warn | dev/preview nicht CI-safe | Nein direkt | Ja | Issue-Fix json patch | alternativ Keystore Workflow | Build smoke |
| `eas-profiles` | warn/fail | Profil/APK inkonsistent | Ja bei fail | Ja | Issue-Fix eas.json | — | rerun |
| `rn-react-compat` | fail | React/RN inkompatibel | Ja | Nein | — | Dependency set manuell angleichen | install + tests |
| `security-workflow-service-role-key` | fail | möglicher Key leak | Ja | Teilweise | patch wenn ableitbar | auf `secrets.*` umstellen + key rotieren | security rerun |
| `workflow-yaml-name-colon-quoting` | fail | YAML `: ` unquoted | Ja | Ja | Issue-Fix quoted names | — | workflow rerun |
| `security-forbidden-files` | fail | key/keystore im Projekt | Ja | Nein | — | Datei entfernen, secret rotieren | security rerun |

## Gap (Blocker ohne robusten Fix)
1. Token-Blocker (`local.githubToken`, `local.expoToken`): kein Direktlink/CTA in Issue-Detail.
2. `repo.expoConfig`/`expo-config-validation` fail: kein Minimal-Config-Generator.
3. `repo.easProjectId`: kein direkter One-Click-Fix aus dem Issue.
4. Prod-Secrets (`repo.secret.supabase*`): kein dedizierter Production Secret Wizard.
5. `rn-react-compat`: nur Manual Steps, kein version-set runbook verlinkt.
6. `security-forbidden-files`: bewusst kein AutoFix, aber stärkeres Manual-Runbook sinnvoll.

## Re-Check Standard nach jedem Fix-Batch
1. Full diagnostics erneut ausführen (local + pipeline).  
2. `DIAGNOSTIC_LAST_OK === "true"` validieren.  
3. profile-spezifisch `development` / `preview` / `production` prüfen.  
4. erst danach Buildstart triggern.
