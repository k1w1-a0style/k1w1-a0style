# 01 — State Contract

## 1) Source of Truth (SoT)

### Verbindliche SoT-Werte
1. **Repo/Branch (autoritativ):** `ProjectData.linkedRepo`, `ProjectData.linkedBranch`
2. **Build Profile (autoritativ):** `ProjectData.preferredBuildProfile`
3. **Diagnostik/CI Status (persistente Read-Model-Flags):**
   - `STORAGE_KEYS.DIAGNOSTIC_LAST_OK`
   - `STORAGE_KEYS.CI_LITE_LINT_OK`
   - `STORAGE_KEYS.CI_LITE_TYPECHECK_OK`
4. **EAS Project ID (persistente Build-Metadaten):** `STORAGE_KEYS.EAS_PROJECT_ID`

### Mirror/Derived (nicht autoritativ)
- `GitHubContext.activeRepo/activeBranch` sind Mirror-State für UX/Navigation und werden aus `ProjectData.linked*` synchronisiert.

---

## 2) Ownership: Wer darf setzen?

## Verbindliches Zielbild (Soll-Contract)
- **Single Writer Repo/Branch:** `ProjectContext.setLinkedRepo(...)`
- **Single Writer BuildProfile:** `ProjectContext.setPreferredBuildProfile(...)`
- **Readers:** alle Screens/Hooks lesen nur aus Context/Storage.

## Ist-Zustand (Code-Evidence)
- `GitHubReposScreen` setzt sowohl `active*` als auch `linked*` (dual write).
- `AppInfo` Import setzt ebenfalls beide Ebenen.
- `GitHubContext` persistiert `active*` separat und mirrored zusätzlich von `linked*`.

➡️ **Bewertung:** Single-Writer ist teilweise umgesetzt, aber noch nicht vollständig strikt.

---

## 3) Persistenz-Regeln

### Projektweite Persistenz (`ProjectData`)
- Read: beim App-Start über `loadProjectFromStorage()`.
- Write: über `updateProject(...)` → debounced/flush gespeichert via `saveProjectToStorage(...)`.
- Enthält `linkedRepo`, `linkedBranch`, `preferredBuildProfile`.

### GitHub UX Persistenz
- `k1w1_github_active_repo`, `k1w1_github_active_branch`, `k1w1_github_recent_repos` werden in `GitHubContext` gespeichert.
- Diese Werte sind als UX-Mirror zu behandeln, nicht als primärer Build-Contract.

### Status-Persistenz (Diagnostik/CI)
- Diagnostic schreibt `DIAGNOSTIC_LAST_OK` nach Lauf.
- Build-Preconditions lesen Diagnostic + CI-Lite Keys als Start-Guard.

---

## 4) Invarianten (müssen immer gelten)
1. Wenn `linkedRepo` geändert wird, muss die UI-Auswahl appweit konsistent sein.
2. `preferredBuildProfile` darf nur `development|preview|production` sein.
3. Build darf nur mit gültigem `owner/repo` und gesetztem Branch starten.
4. Keine hartkodierte Branch-Fallbacks im kritischen Buildpfad.

**UNSICHER:** In mehreren Side-Flows existiert `|| "main"` Fallback weiterhin; dieser Zustand verletzt Invariante 4 teilweise und muss bereinigt werden.

---

## Evidence

### Evidence A — Setzer für SoT in ProjectContext
**Datei:** `contexts/ProjectContext.tsx`  
**Symbol:** `setLinkedRepo`, `setPreferredBuildProfile`
```ts
const setLinkedRepo = useCallback(
  async (repo: string | null, branch?: string | null) => {
    await updateProject((prev) => ({
      ...prev,
      linkedRepo: repo,
      linkedBranch: branch ?? prev.linkedBranch ?? null,
    }));
  },
  [updateProject],
);

const setPreferredBuildProfile = useCallback(
  async (profile: "development" | "preview" | "production") => {
    await updateProject((prev) => ({ ...prev, preferredBuildProfile: profile }));
  },
  [updateProject],
);
```

### Evidence B — Project-Persistenz read/write
**Datei:** `infra/storage/projectPersistence.ts`  
**Symbol:** `saveProjectToStorage`, `loadProjectFromStorage`
```ts
const projectString = JSON.stringify(projectToSave);
await AsyncStorage.setItem(PROJECT_STORAGE_KEY, projectString);

const projectString = await AsyncStorage.getItem(PROJECT_STORAGE_KEY);
if (!projectString) return null;
const project = JSON.parse(projectString);
```

### Evidence C — GitHub Mirror + persistente active Keys
**Datei:** `contexts/GitHubContext.tsx`  
**Symbol:** `setActiveRepo`, `setActiveBranch`, mirror-effect
```ts
if (repo) {
  AsyncStorage.setItem(ACTIVE_REPO_KEY, repo).catch(() => {});
} else {
  AsyncStorage.removeItem(ACTIVE_REPO_KEY).catch(() => {});
}

if (linkedRepo !== activeRepo) {
  setActiveRepo(linkedRepo);
}
```

### Evidence D — Diagnostic schreibt persistenten OK-Status
**Datei:** `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts`  
**Symbol:** Run-Abschluss
```ts
const hasFails = all.some((r) => r.status === "fail");
await AsyncStorage
  .setItem(STORAGE_KEYS.DIAGNOSTIC_LAST_OK, hasFails ? "false" : "true")
  .catch(() => {});
```

### Evidence E — CI/Diagnostic Keys zentral definiert
**Datei:** `lib/storageKeys.ts`  
**Symbol:** `STORAGE_KEYS`
```ts
DIAGNOSTIC_LAST_OK: "diagnostic_last_ok",
CI_LITE_LINT_OK: "ci_lite_lint_ok",
CI_LITE_TYPECHECK_OK: "ci_lite_typecheck_ok",
EAS_PROJECT_ID: "eas_project_id",
```
