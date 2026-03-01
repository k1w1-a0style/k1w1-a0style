# 02 — Build Pipeline Contract

## 1) E2E-Flow (verbindlich)

1. **UI Layer** (`EnhancedBuildScreen`) startet `onStartBuild`.
2. **Guardrails** prüfen Repo/Branch/Tokens/Diagnostics/Signing.
3. **Context Layer** (`ProjectContext.startBuild`) normalisiert Profil + delegiert an Service.
4. **Service Layer** (`project/services/buildStartService.startBuildJob`) macht:
   - Repo/Branch auflösen,
   - Best-effort Push,
   - Workflow Auto-Fix,
   - Supabase Edge Function Invoke.
5. **Result Layer** liefert `jobId` (UUID), Repo, Branch, Profile zurück.
6. **Status Layer** pollt Buildstatus und schreibt Build-History.

---

## 2) Start-Validierungen (Blocker)

Build MUSS blockiert werden bei:
- ungültigem Repo (`owner/repo` fehlt),
- leerem Branch,
- fehlenden Tokens (GitHub+Expo),
- fehlendem Signing Key,
- Diagnostic nicht grün.

Build DARF starten bei:
- validem Repo/Branch,
- alle kritischen Preconditions erfüllt.

Hinweis: CI Lite ist im UI derzeit informative/pending Ampel, aber kein harter Blocker.

---

## 3) Verbotene Patterns

1. **Branch-Fallback im kritischen Pfad** (`|| "main"`) statt expliziter User-Selektion.
2. **Hardcoded Repo/Branch** im Buildstart (außer ggf. bewusstem, dokumentiertem Bootstrap-Notfall).
3. **Lokale Schattenkopien** von SoT-Werten, die ohne Sync weiterleben.

**UNSICHER:** Der Ist-Code enthält weiterhin `"main"`-Fallbacks in mehreren Hooks/Services. Diese sollten schrittweise auf „blockieren + explizite Auswahl erzwingen“ umgestellt werden.

---

## 4) Pipeline-Guardrails (Soll)

- `startBuildJob` soll nur mit `project.linkedRepo` + `project.linkedBranch` laufen.
- Falls Branch fehlt: Fehler statt Fallback.
- Falls Repo fehlt: Fehler statt `CONFIG.BUILD.GITHUB_REPO` Fallback.
- Alle Dispatches (`triggerWorkflow`, build invoke) müssen denselben Branch verwenden.

---

## Evidence

### Evidence A — UI blockt Build bei fehlenden Preconditions
**Datei:** `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts`  
**Symbol:** `buildBlockedReason`, `onStartBuild`
```ts
if (!repoValidation.valid) return "Repo fehlt ...";
if (!branchName.trim()) return "Branch fehlt ...";
if (!hasTokens) return "Tokens fehlen ...";
if (!hasDiagOk) return "Diagnostik nicht gruen ...";
if (!hasSigningKey) return "Signing Key fehlt ...";

if (buildBlockedReason) {
  Alert.alert("Nicht bereit", sanitizeUiMessage(buildBlockedReason));
  return;
}
```

### Evidence B — Context delegiert an startBuildJob
**Datei:** `contexts/ProjectContext.tsx`  
**Symbol:** `startBuild`
```ts
const started = await startBuildJob({
  project: pd,
  buildProfile: profile,
});
```

### Evidence C — Service triggert Edge Function und validiert jobId
**Datei:** `project/services/buildStartService.ts`  
**Symbol:** `startBuildJob`
```ts
const { data, error } = await supabase.functions.invoke(
  SUPABASE_EDGE_FUNCTIONS.TRIGGER_EAS_BUILD,
  invokeOpts,
);
if (error) throw error;
// ...
if (!jobId) throw new Error("... keine gueltige Job-ID ...");
if (!isUuid(jobId)) throw new Error("... ungueltige Job-ID ...");
```

### Evidence D — Aktueller Branch-Fallback auf "main" (Risiko)
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

### Evidence E — Weitere "main"-Fallbacks in UI/Flows
**Datei:** `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`  
**Symbol:** `onLinkExisting`, `onCreateAndLink`
```ts
const branch =
  (activeBranch || projectData?.linkedBranch || "main").trim() || "main";
```
