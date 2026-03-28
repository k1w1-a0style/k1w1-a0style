# 06 — Build Readiness Gate (verbindlich)

## Ziel
Ein Build darf nur starten, wenn alle profilabhängigen Voraussetzungen erfüllt sind.
Kein stiller Fallback bei Repo/Branch/Profil/Secrets.

---

## 1) Preconditions nach Build-Profil

### 1.1 Development
- Repo + Branch aus SoT (`projectData.linkedRepo`, `projectData.linkedBranch`) müssen gesetzt/valide sein.
- GitHub + Expo Token vorhanden.
- Signing-Status `CRED_KEY_EXISTS_DEV === "true"`.
- Letzte Diagnostik `DIAGNOSTIC_LAST_OK === "true"`.
- Workflow-Dateien im Ziel-Repo vorhanden (`eas-build.yml`, `k1w1-triggered-build.yml`, `eas-link.yml`, `release-build.yml`) via AutoFix.
- `eas.json` enthält `build.development` (APK, `withoutCredentials: true`).

### 1.2 Preview
- Alle Punkte aus development, aber Signing-Status `CRED_KEY_EXISTS_PREVIEW === "true"`.
- `eas.json` enthält `build.preview` (APK, `withoutCredentials: true`).

### 1.3 Production
- Alle Punkte aus preview plus:
- `CRED_KEY_EXISTS_PRODUCTION === "true"`.
- Für Workflow/Status-Update und Keystore-Export in CI: GitHub-Secrets `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- `eas.json` enthält `build.production` mit `credentialsSource: "local"`.
- `EXPO_TOKEN` ist weiterhin Pflicht.

---

## 2) Build Readiness Matrix

| Item | Pflicht (dev/preview/prod) | Quelle (SoT) | Validierung | Blockiert Build? | Fehlertext | AutoFix? | AutoFix / Manual |
|---|---|---|---|---|---|---|---|
| Repo ausgewählt (`owner/repo`) | Ja/Ja/Ja | `projectData.linkedRepo` | `validateRepoFullName(repo).valid` | Ja | `Repo fehlt oder ungültig` | Nein | Repo im Repo-Screen/ProjectContext verknüpfen |
| Branch ausgewählt | Ja/Ja/Ja | `projectData.linkedBranch` | `branchName.trim().length > 0` | Ja | `Branch fehlt` | Nein | Branch explizit im Repo-Screen wählen |
| Build-Profil gültig | Ja/Ja/Ja | `preferredBuildProfile` / Start-Parameter | `development|preview|production` | Ja | `Ungültiges Build-Profil` | Teilweise | UI-Picker korrigieren, Service normalisiert nur als Failsafe |
| GitHub+Expo Token vorhanden | Ja/Ja/Ja | SecureStore (`tokenStore`) | `getGitHubToken` + `getExpoToken` beide nicht leer | Ja | `Tokens fehlen (GitHub + Expo)` | Nein | Verbindungen-Screen Token setzen |
| Diagnostics grün | Ja/Ja/Ja | `DIAGNOSTIC_LAST_OK` | AsyncStorage key exakt `"true"` | Ja | `Diagnostik nicht grün` | Nein | Diagnostics ausführen |
| Signing-Key vorhanden (profilbezogen) | Ja/Ja/Ja | `CRED_KEY_EXISTS_*` | `credKeyForProfile(profile)` muss `"true"` sein | Ja | `Signing Key fehlt` | Teilweise | Credentials Wizard: Status refresh/generate |
| EAS Auth Secret in GitHub (`EXPO_TOKEN`) | Ja/Ja/Ja | Repo GitHub Secrets | Workflow Validate Inputs (`Missing GitHub Secret EXPO_TOKEN`) | Ja | `Missing GitHub Secret EXPO_TOKEN` | Ja | `autoSyncRepoSecrets` synct `EXPO_TOKEN` falls lokal vorhanden |
| Supabase Secrets in GitHub (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) | Nein/Nein/Ja | Repo GitHub Secrets | `eas-build.yml` blockt production bei fehlenden Werten | Ja (nur prod) | `Production build requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY` | Ja | `autoSyncRepoSecrets` (wenn lokal vorhanden), sonst manuell im Repo-Secret setzen |
| EAS Project Linking (`eas-project.json`/projectId) | Nein*/Empf./Empf. | Repo-Datei + `EAS_PROJECT_ID` key | `eas-link.yml` erzeugt/aktualisiert `eas-project.json` | Warnung (Gate), harter Fehler kann später in Workflow kommen | `EAS Project ID fehlt/unlinked` | Ja | `eas-link.yml` triggern, `Sync` drücken |
| Workflow-Dateien vorhanden | Ja/Ja/Ja | Ziel-Repo `.github/workflows/*` | `autoFixCIWorkflows` schreibt Soll-Templates | Ja | `Pflicht-Workflow fehlt` | Ja | AutoFix (createOrUpdateFile), sonst manuell committen |
| EAS Profile in Repo (`eas.json`) | Ja/Ja/Ja | Ziel-Repo `eas.json` | Profile-Definition vorhanden + prod credentialsSource local | Ja | `eas.json Profil unvollständig` | Nein | `eas.json` im Zielrepo korrigieren |
| Project Files vorhanden | Ja/Ja/Ja | `project.files` | `project.files.length > 0` | Ja | `Projekt ist leer` | Nein | Dateien erzeugen/importieren |

\* `EAS_PROJECT_ID` ist im App-Secret-Sync optional, kann aber je nach Zielrepo/Workflow als Laufzeitfehler auftreten; deshalb als Gate-Warnung + klarer Fixpfad.

---

## 3) Gate-Regeln (UI + Service)

### 3.1 UI-Gate (Button Disabled + Alert)
- Build-Button ist disabled, wenn ein Blocker offen ist.
- `buildBlockedReason` priorisiert harte Blocker: Repo, Branch, Tokens, Diagnostics, Signing.
- Bei Klick trotz Race wird `Alert("Nicht bereit", reason)` gezeigt und Start abgebrochen.

### 3.2 Service-Gate (Throw im Start-Service)
Der Service muss dieselben Regeln servernah erzwingen, damit keine Umgehung via alternativen Call-Pfad möglich ist.

**Verbindliche Regel:** Vor Git Push / Workflow Dispatch / Supabase invoke wird eine zentrale `assertBuildReadiness(...)` ausgeführt und wirft bei jedem Blocker.

### 3.3 Warnung vs Blocker
- **Blocker:** Repo ungültig, Branch leer, Profil ungültig, Token fehlt, Signing fehlt, Diagnostics fail/unknown, notwendige profilabhängige Secrets fehlen.
- **Warnung:** CI Lite rot/unknown, optionale Keys (`EAS_PROJECT_ID`, `K1W1_EDGE_WORKFLOW_ADMIN_KEY`, `K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY`) fehlen, solange Build-Flow ohne diese lauffähig bleibt.
- **Wichtig (lokale Readiness):** Workflow-/Build-/Artifact-Pfade prüfen den **lokalen Workflow Admin Key** getrennt; Keystore-bezogene Pfade prüfen den **lokalen Android Keystore Export Admin Key** getrennt. Ein vorhandener Legacy-Key allein darf kein false-green erzeugen.
- **Wichtig (Keystore-Wizard Contract, Patch 597):** Keystore-Status/Generate-Calls im Wizard sind nur mit Kombi-Header gueltig: `Authorization: Bearer <Supabase user JWT>` + `x-k1w1-admin-key: <lokaler androidKeystoreExportAdminKey>`.
- **Wichtig (Patch 598):** `SIGNING_ADMIN_KEY` ist kein generischer Fallback mehr fuer `x-k1w1-admin-key`-Legacy-Routen. Generische Legacy-Guards laufen ausschliesslich ueber `K1W1_EDGE_ADMIN_KEY`; signing-spezifische Pfade muessen dedizierte Guards nutzen.
- **Wichtig (Patch 599, Config-SoT):** Fuer `android-keystore-status` und `android-keystore-generate` ist `supabase/config.toml` die einzige `verify_jwt`-Quelle (`true`). Funktionslokale Keystore-Configs gelten hier bewusst nicht mehr, um Split-Brain zwischen Root- und Route-Config auszuschliessen.
- **Wichtig (Patch 602, CI-/Smoke-Contract):** `scripts/ci-lite-env-load.sh` und `scripts/ci-lite-smoke.sh` verlangen im workflow-/build-/artifact-nahen Scope jetzt die Kombi aus `K1W1_EDGE_WORKFLOW_ADMIN_KEY` **und** `K1W1_EDGE_WORKFLOW_JWT` (`Authorization: Bearer <jwt>`), plus einen expliziten `<ref>` fuer den Smoke-Dispatch. Legacy-/Generic-Fallbacks auf `ADMIN_KEY`/`K1W1_EDGE_ADMIN_KEY` sowie stilles `main` sind bewusst entfernt (fail-closed gegen false-green).
- **Wichtig (Patch 603, Legacy-Teststub-Guard):** `supabase/functions/test` bleibt bewusst disabled (`410 legacy_test_route_disabled`), ist aber jetzt sauber scoped-auth-konfiguriert (`scope: "test"`, `adminSecretEnv: "K1W1_EDGE_ADMIN_KEY"`, `allowAdmin: true`, `allowCiBearer: false`), damit keine Guard-Misconfiguration mehr vorzeitig in `500` endet.

---

### 3.4 Edge-/Infra-Contract (Patch 590)
- `trigger-eas-build` akzeptiert serverseitig nur noch Requests mit explizitem nicht-leerem `branch` (nach `trim()`).
- Fehlender/leer/Whitespace-Branch wird am Edge-Eingang mit 400 abgelehnt (fail-closed).
- Tieferliegende branch-/ref-sensitive Infra-Helper sind jetzt ebenfalls fail-closed: kein stiller `"main"`-Fallback mehr in `infra/github/workflows.ts`, `infra/github/files.ts` und `infra/github/branchOps.ts`; fehlender expliziter Branch/Ref wird mit klarem Fehler abgebrochen.

## 4) Single Entry Point (Code-Verankerung)

### Verbindlicher Einstieg
- `project/services/buildStartService.ts::startBuildJob` ist der einzige technische Eintrittspunkt für Build-Starts.
- `contexts/ProjectContext.tsx::startBuild` delegiert an genau diesen Service.

### Erforderliche Durchsetzung
- Gate-Funktion als dedizierte Funktion im Service-Layer (z. B. `assertBuildReadiness`) direkt in `startBuildJob` vor `bestEffortPushToGitHub(...)` und vor `supabase.functions.invoke(...)`.
- UI-Checks bleiben UX-Feedback, aber **nicht** einzige Sicherheitsinstanz.

---

## 5) Evidence je Matrix-Zeile

### E1 — Repo-Validierung + Blockertext
**Datei:** `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts`  
**Symbol:** `buildBlockedReason`
```ts
const repoValidation = useMemo(() => validateRepoFullName(repoFullName), [repoFullName]);

const buildBlockedReason = useMemo(() => {
  if (!repoValidation.valid) return "Repo fehlt oder ungueltig (owner/repo)";
  if (!branchName.trim()) return "Branch fehlt (im Repo-Screen auswaehlen)";
  if (!hasTokens) return "Tokens fehlen (GitHub + Expo) – im Verbindungen-Screen setzen";
  if (!hasDiagOk) return "Diagnostik nicht gruen – im Diagnostic-Screen ausfuehren";
  if (!hasSigningKey) return "Signing Key fehlt – im Wizard generieren";
  return null;
}, [repoValidation.valid, branchName, hasTokens, hasDiagOk, hasSigningKey]);
```

### E2 — Branch kommt aus SoT (kein eigener State)
**Datei:** `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts`  
**Symbol:** `branchName`
```ts
const branchName = useMemo(() => {
  const fromBuild = String(currentBuild?.branch ?? "").trim();
  return projectData?.linkedBranch?.trim() || fromBuild || "";
}, [projectData?.linkedBranch, currentBuild?.branch]);
```

### E3 — Token-Check (GitHub + Expo)
**Datei:** `screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts`  
**Symbol:** `refreshPreconditions`
```ts
const [gh, expo] = await Promise.all([
  getGitHubToken().catch(() => ""),
  getExpoToken().catch(() => ""),
]);
if (isMountedRef.current) setHasTokens(!!(gh && expo));
```

### E4 — Signing-Check pro Profil
**Datei:** `screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts`  
**Symbol:** `refreshPreconditions`
```ts
const keyMode = buildProfile === "development" ? "dev" : buildProfile;
const credKey = credKeyForProfile(
  keyMode === "dev" ? "development" : (keyMode as "preview" | "production"),
);
const val = await AsyncStorage.getItem(credKey).catch(() => null);
if (isMountedRef.current) setHasSigningKey(val === "true");
```

### E5 — Diagnostics als Blockerquelle
**Datei:** `screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts`  
**Symbol:** `refreshPreconditions`
```ts
const diagVal = await AsyncStorage.getItem(STORAGE_KEYS.DIAGNOSTIC_LAST_OK).catch(() => null);
if (isMountedRef.current) setHasDiagOk(diagVal === "true");
```

### E6 — Signing-Status wird vom Wizard persistiert
**Datei:** `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts`  
**Symbol:** `refreshStatusCore`
```ts
const data = r.data as StatusResult;
if (isMountedRef.current) setStatusByMode((prev) => ({ ...prev, [mode]: data }));
const credKey = credKeyForUiMode(mode);
await AsyncStorage.setItem(credKey, data.exists ? "true" : "false").catch(() => {});
```

### E7 — Service Entry Point + aktuelle Repo-Fallback-Risiken
**Datei:** `project/services/buildStartService.ts`  
**Symbol:** `startBuildJob`
```ts
const githubRepo = (project.linkedRepo?.trim() || CONFIG.BUILD.GITHUB_REPO).trim();
const profile = normalizeProfile(buildProfile);

let buildBranch =
  typeof project.linkedBranch === "string" ? project.linkedBranch.trim() : "";

buildBranch = await bestEffortPushToGitHub({
  githubRepo,
  branchHint: buildBranch,
  files: project.files,
});
```

### E8 — Branch-Fallback auf `main` im Service (muss im Gate abgefangen werden)
**Datei:** `project/services/buildStartService.ts`  
**Symbol:** `bestEffortPushToGitHub`
```ts
if (!branch) {
  try {
    branch = (await getDefaultBranch(owner, repo)).trim();
  } catch (err) {
    logger.warn("Default-Branch konnte nicht ermittelt werden, fallback auf 'main'", { err });
    branch = "main";
  }
}
if (!branch) branch = "main";
```

### E9 — ProjectContext delegiert nur an Service
**Datei:** `contexts/ProjectContext.tsx`  
**Symbol:** `startBuild`
```ts
const started = await startBuildJob({
  project: pd,
  buildProfile: profile,
});
```

### E10 — Workflow-Pflichtdateien werden durch AutoFix gemanagt
**Datei:** `lib/diagnostics/ciAutoFix.ts`  
**Symbol:** `WORKFLOWS`, `autoFixCIWorkflows`
```ts
const WORKFLOWS: Record<string, string> = {
  "k1w1-triggered-build.yml": WORKFLOW_K1W1_TRIGGERED_BUILD,
  "eas-build.yml": WORKFLOW_EAS_BUILD,
  "release-build.yml": WORKFLOW_RELEASE_BUILD,
  "eas-link.yml": WORKFLOW_EAS_LINK,
};
```

### E11 — Required Secret-Minimum für Repo-Checks
**Datei:** `lib/diagnostics/ciAutoFix.ts`  
**Symbol:** `REQUIRED_SECRETS`
```ts
export const REQUIRED_SECRETS = ["EXPO_TOKEN"];
```

### E12 — Production braucht zusätzliche Supabase-Secrets
**Datei:** `.github/workflows/eas-build.yml`  
**Symbol:** `Validate inputs`
```yml
if [ "${{ inputs.profile }}" = "production" ]; then
  if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    echo "::error::Production build requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (local Android keystore)."
    exit 1
  fi
fi
```

### E13 — EXPO_TOKEN ist Workflow-Pflicht
**Datei:** `.github/workflows/eas-build.yml`  
**Symbol:** `workflow_call.secrets`, `Validate inputs`
```yml
secrets:
  EXPO_TOKEN:
    required: true

if [ -z "${EXPO_TOKEN:-}" ]; then
  echo "::error::Missing GitHub Secret EXPO_TOKEN"
  exit 1
fi
```

### E14 — Secrets-Sync (inkl. optionaler Keys) vorhanden
**Datei:** `lib/autoSyncRepoSecrets.ts`  
**Symbol:** `autoSyncRepoSecrets`
```ts
if (!expoToken) skipped.push("EXPO_TOKEN (missing)");
if (!supabaseUrl) skipped.push("SUPABASE_URL (missing)");
if (!supabaseServiceRole) skipped.push("SUPABASE_SERVICE_ROLE_KEY (missing)");
if (!easProjectId) skipped.push("EAS_PROJECT_ID (optional, empty)");
if (!workflowAdminKey) skipped.push("K1W1_EDGE_WORKFLOW_ADMIN_KEY (optional, empty)");
if (!androidKeystoreExportAdminKey) skipped.push("K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY (optional, empty)");
if (!legacyEdgeAdminKey) skipped.push("K1W1_EDGE_ADMIN_KEY (legacy optional, empty)");
// Patch 603: legacy test edge route (`supabase/functions/test`) bleibt bewusst deaktiviert
// und ist jetzt scoped-auth-konsistent (`scope: "test"`, `allowAdmin: true`) auf fail-closed `410 legacy_test_route_disabled` gehaertet.
if (!signingAdminKey) skipped.push("SIGNING_ADMIN_KEY (legacy optional, empty)");
```

### E15 — Profilabhängige Credentials-Strategie in `eas.json`
**Datei:** `eas.json`  
**Symbol:** `build.development`, `build.preview`, `build.production`
```json
"development": {
  "android": { "buildType": "apk", "withoutCredentials": true }
},
"preview": {
  "android": { "buildType": "apk", "withoutCredentials": true }
},
"production": {
  "android": { "buildType": "apk", "credentialsSource": "local" }
}
```

### E16 — EAS Link Workflow erzeugt/aktualisiert `eas-project.json`
**Datei:** `.github/workflows/eas-link.yml`  
**Symbol:** `EAS project:init (link/create)`
```yml
if [ -n "${EAS_PROJECT_ID_INPUT:-}" ]; then
  eas project:init --id "${EAS_PROJECT_ID_INPUT}" --non-interactive --force "${OWNER_ARGS[@]}"
  node -e 'const fs=require("fs"); fs.writeFileSync("eas-project.json", JSON.stringify({projectId: process.argv[1]}, null, 2)+"\\n");' "${EAS_PROJECT_ID_INPUT}"
else
  eas project:init --non-interactive --force "${OWNER_ARGS[@]}"
fi
```

---

## 6) Konkrete Implementierungsanweisung (nächster Code-Patch)

1. In `project/services/buildStartService.ts` vor `bestEffortPushToGitHub`:
   - `assertBuildReadiness({ project, buildProfile })` aufrufen.
2. `assertBuildReadiness` liefert:
   - `errors[]` (Blocker),
   - `warnings[]` (nicht-blockierend),
   - normalisierte `repo/branch/profile` ohne stille Defaults.
3. Bei `errors.length > 0`:
   - `throw new Error("Build Readiness Gate failed: ...")`.
4. UI kann weiterhin `buildBlockedReason` für sofortiges Feedback nutzen; Service bleibt letzte harte Instanz.

Damit wird der Buildflow „wasserdicht“ gegen Umgehungen außerhalb der Build-Screen-UI.

## Related
- Diagnostics → Fix Playbook: `docs/07-diagnostics-fix-playbook.md`
- Test Coverage Matrix: `docs/08-test-coverage-matrix.md`
- Smoke Plan: `docs/04-testing-smoke-plan.md`
- Gap Tickets: `docs/09-gap-tickets.md`
