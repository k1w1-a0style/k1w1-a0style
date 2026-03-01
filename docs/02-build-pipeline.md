# 02 — Build Pipeline Contract

## 1) E2E-Flow (verbindlich)

1. **UI Layer** (`EnhancedBuildScreen`) startet `onStartBuild`.
2. **UI-Gate** prüft harte Preconditions (Repo, Branch, Tokens, Diagnostics, Signing).
3. **Context Layer** (`ProjectContext.startBuild`) normalisiert Profil + delegiert an Service.
4. **Service-Gate (Single Entry Point)** (`project/services/buildStartService.startBuildJob`) erzwingt dieselben Regeln servernah.
5. **Service Pipeline** macht erst danach:
   - Repo/Branch auflösen,
   - Best-effort Push,
   - Workflow Auto-Fix,
   - Supabase Edge Function Invoke.
6. **Result Layer** liefert `jobId` (UUID), Repo, Branch, Profile zurück.
7. **Status Layer** pollt Buildstatus und schreibt Build-History.

---

## 2) Build Readiness Gate (hart)

### 2.1 Blocker
Build MUSS blockiert werden bei:
- ungültigem Repo (`owner/repo` fehlt),
- leerem Branch,
- ungültigem Profil (nicht development/preview/production),
- fehlenden Tokens (GitHub+Expo),
- fehlendem Signing Key für aktives Profil,
- Diagnostic nicht grün,
- `project.files` leer.

Zusätzlich profilabhängig:
- **production**: fehlende GitHub-Secrets `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` als Blocker.

### 2.2 Warnings (kein Hard-Block)
- CI-Lite nicht grün,
- `EAS_PROJECT_ID` fehlt (optional; kann später Workflow-Fehler verursachen),
- optionaler `K1W1_EDGE_ADMIN_KEY` fehlt.

### 2.3 UI-Verhalten
- Build-Button disabled, sobald mindestens ein Blocker offen ist.
- Klick auf Start mit Blocker zeigt `Alert("Nicht bereit", reason)`.

### 2.4 Service-Verhalten
- `startBuildJob` muss **vor** GitHub/Supabase-Aufrufen das Gate ausführen.
- Bei Blocker: `throw` mit aggregierter Fehlermeldung.
- Keine stillen Fallbacks (`repo || CONFIG`, `branch || "main"`) im kritischen Startpfad.

---

## 3) Verbotene Patterns

1. **Branch-Fallback im kritischen Pfad** (`|| "main"`) statt expliziter User-Selektion.
2. **Hardcoded Repo/Branch** im Buildstart (außer bewusstem, dokumentiertem Bootstrap-Notfall).
3. **Lokale Schattenkopien** von SoT-Werten, die ohne Sync weiterleben.

**Ist-Risiko:** Der aktuelle Service enthält weiterhin `main`-Fallback im Push-Pfad und Repo-Config-Fallback; diese sind im Gate vorab als harte Fehler abzufangen.

---

## 4) Single Entry Point (verbindlich)

- **Technischer Entry Point:** `project/services/buildStartService.startBuildJob`.
- **Aufrufkette:** `screens/EnhancedBuildScreen` → `contexts/ProjectContext.startBuild` → `startBuildJob`.
- **Regel:** Jeder Buildstart (auch One-Click und zukünftige Trigger) muss durch diesen Entry Point laufen; dort wird das Gate zentral erzwungen.

---

## Evidence

### Evidence A — UI-Blockertexte + Alert
**Datei:** `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts`  
**Symbol:** `buildBlockedReason`, `onStartBuild`
```ts
if (!repoValidation.valid) return "Repo fehlt oder ungueltig (owner/repo)";
if (!branchName.trim()) return "Branch fehlt (im Repo-Screen auswaehlen)";
if (!hasTokens) return "Tokens fehlen (GitHub + Expo) – im Verbindungen-Screen setzen";
if (!hasDiagOk) return "Diagnostik nicht gruen – im Diagnostic-Screen ausfuehren";
if (!hasSigningKey) return "Signing Key fehlt – im Wizard generieren";

if (buildBlockedReason) {
  Alert.alert("Nicht bereit", sanitizeUiMessage(buildBlockedReason));
  return;
}
```

### Evidence B — Token/Signing/Diagnostic werden zentral geladen
**Datei:** `screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts`  
**Symbol:** `refreshPreconditions`
```ts
const [gh, expo] = await Promise.all([
  getGitHubToken().catch(() => ""),
  getExpoToken().catch(() => ""),
]);
if (isMountedRef.current) setHasTokens(!!(gh && expo));

const val = await AsyncStorage.getItem(credKey).catch(() => null);
if (isMountedRef.current) setHasSigningKey(val === "true");

const diagVal = await AsyncStorage.getItem(STORAGE_KEYS.DIAGNOSTIC_LAST_OK).catch(() => null);
if (isMountedRef.current) setHasDiagOk(diagVal === "true");
```

### Evidence C — Context delegiert an Service Entry Point
**Datei:** `contexts/ProjectContext.tsx`  
**Symbol:** `startBuild`
```ts
const started = await startBuildJob({
  project: pd,
  buildProfile: profile,
});
```

### Evidence D — Service führt Build-Invoke aus + validiert jobId
**Datei:** `project/services/buildStartService.ts`  
**Symbol:** `startBuildJob`
```ts
const { data, error } = await supabase.functions.invoke(
  SUPABASE_EDGE_FUNCTIONS.TRIGGER_EAS_BUILD,
  invokeOpts,
);
if (error) throw error;

if (!jobId) throw new Error("... keine gueltige Job-ID ...");
if (!isUuid(jobId)) throw new Error("... ungueltige Job-ID ...");
```

### Evidence E — Production-Secret-Blocker im CI-Workflow
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

### Evidence F — Aktueller Branch-Fallback auf `main` (zu verhindern)
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
