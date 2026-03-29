# 01 — Global State & Persistence Contract (Single Source of Truth)

> Zielbild: **nicht screen-first**, sondern app-weite Zustandsregeln mit klarer Ownership, Persistenz und Hydration.

> Quick Reference (kompakt): `docs/14-state-quickref.md`

## A) Global State Inventory

### A.1 Core Selection State (autoritativ für Repo/Branch/Profile)

| Zustand | Typ | Default | Persistenz | SoT aktuell | Read/Write-Orte |
|---|---|---|---|---|---|
| `projectData.linkedRepo` | `string \| null \| undefined` | neues Projekt: `undefined` | im Projekt-Blob `k1w1_project_data` | `ProjectContext` / `ProjectData` | Schreiben: `setLinkedRepo(...)`; Lesen: Build/Diagnostic/Wizard/Connections über `projectData` |
| `projectData.linkedBranch` | `string \| null \| undefined` | neues Projekt: `undefined` | im Projekt-Blob `k1w1_project_data` | `ProjectContext` / `ProjectData` | Schreiben: `setLinkedRepo(repo, branch)`; Lesen: Build/Diagnostic/Wizard/Connections |
| `projectData.preferredBuildProfile` | `"development" \| "preview" \| "production" \| null` | initial meist UI-Fallback (`preview` oder `dev`) | im Projekt-Blob `k1w1_project_data` | `ProjectContext` / `ProjectData` | Schreiben: `setPreferredBuildProfile(...)`; Lesen: Build + Wizard + Drawer-Chip |
| `activeRepo` (GitHubContext) | `string \| null` | aus `projectData.linkedRepo` abgeleitet | keine eigene Persistenz (Legacy-Key wird bereinigt) | **Derived Read-Model** (nicht autoritativ) | Schreiben: indirekt über `setLinkedRepo(...)`; Lesen: Header/Drawer/Repo-Screen |
| `activeBranch` (GitHubContext) | `string \| null` | aus `projectData.linkedBranch` abgeleitet | keine eigene Persistenz (Legacy-Key wird bereinigt) | **Derived Read-Model** (nicht autoritativ) | Schreiben: indirekt über `setLinkedRepo(repo, branch)`; Lesen: Header/Drawer/Repo-Screen |
| `recentRepos` (GitHubContext) | `string[]` | `[]` | `k1w1_github_recent_repos` | GitHubContext | Schreiben: `addRecentRepo`; Lesen: Repo-Screen |
| `RECENT_BRANCHES_BY_REPO` | `Record<string,string[]>` (JSON) | `{}` | `recent_branches_by_repo` | AsyncStorage Read-Model | Schreiben: Repo-Screen branch selection; Lesen: BranchSelector |

### A.2 Connection & Credential State (Persistente Lampen/Flags)

| Zustand | Typ | Default | Persistenz-Key | SoT aktuell | Read/Write-Orte |
|---|---|---|---|---|---|
| GitHub-Lampe | `"true"/"false"` | `false` | `CONN_GITHUB_OK` | AsyncStorage | Schreiben: Connections test/save/reset |
| GitHub User/Scopes | `string` | leer | `CONN_GITHUB_USER`, `CONN_GITHUB_SCOPES` | AsyncStorage | Schreiben: Connections test/save/reset |
| Expo-Lampe/User | `"true"/"false"`, `string` | `false`, leer | `CONN_EXPO_OK`, `CONN_EXPO_USER` | AsyncStorage | Schreiben: Connections test/save/reset |
| Supabase-Lampe/Ref | `"true"/"false"`, `string` | `false`, leer | `CONN_SUPABASE_OK`, `CONN_SUPABASE_REF` | AsyncStorage | Schreiben: Connections test/save/reset |
| EAS-Lampe | `"true"/"false"` | `false` | `CONN_EAS_OK` | AsyncStorage | Schreiben: Connections EAS-Test/Link-Workflow |
| Repo-Lampe/Slug/Branch | `"true"/"false"`, `string` | `false` | `CONN_REPO_OK`, `CONN_REPO_SLUG`, `CONN_REPO_BRANCH` | AsyncStorage (UX-Lampe) | Schreiben: Connections (workflow start) |
| EAS Project ID | `string` | leer/fehlend | `EAS_PROJECT_ID` | AsyncStorage | Schreiben: Connections + AppInfo Import; Lesen: Connections/GitHubRepos/Backup |
| Wizard Key Exists (pro Profil) | `"true"/"false"` | unknown (fehlender Key) | `CRED_KEY_EXISTS_DEV/PREVIEW/PRODUCTION` | AsyncStorage | Schreiben: CredentialsWizard status-refresh; Lesen: Build Preconditions / One-Click |

### A.3 Diagnostics / CI Lite / Build / Chat

| Zustand | Typ | Default | Persistenz-Key | SoT aktuell | Read/Write-Orte |
|---|---|---|---|---|---|
| Diagnostic letzter OK | `"true"/"false"` | unknown (fehlender Key) | `DIAGNOSTIC_LAST_OK` | AsyncStorage | Schreiben: Diagnostic Run-Ende; Lesen: Build Preconditions |
| CI Lite Lint/Typecheck OK | `"true"/"false"` | unknown | `CI_LITE_LINT_OK`, `CI_LITE_TYPECHECK_OK` | AsyncStorage | Schreiben: CI Lite Hook bei completed run; Lesen: Build Preconditions |
| CI Lite Last Run At | `string` (epoch ms) | fehlt | `CI_LITE_LAST_RUN_AT` | AsyncStorage | Schreiben: CI Lite Hook |
| Build History | `BuildHistoryEntry[]` | `[]` | `BUILD_HISTORY` | AsyncStorage + Helper | Schreiben: `addBuildToHistory/update...`; Lesen: Build UI |
| Chat Persist History | bool (als `1/0`) | `true` | `CHAT_PERSIST_HISTORY` | AsyncStorage + helper API | Lesen/Schreiben: `chatPrivacySettings` + Settings |
| Chat Retention Limit | Zahl | `200` | `CHAT_RETENTION_LIMIT` | AsyncStorage + helper API | Lesen/Schreiben: `chatPrivacySettings` |
| One Click Auto Sync | `"true"/"false"` | `false` | `ONE_CLICK_AUTO_SYNC_SECRETS` | AsyncStorage | Schreiben: OneClick toggle; Lesen: OneClick init |

### A.4 Sensitive Secret State (SecureStore)

| Zustand | Storage | SoT | Writer |
|---|---|---|---|
| GitHub Token, Expo Token | SecureStore | tokenStore helpers | `saveGitHubToken/saveExpoToken` |
| Workflow Admin Key | SecureStore | tokenStore helpers | `saveWorkflowAdminKey` |
| Android Keystore Export Admin Key | SecureStore | tokenStore helpers | `saveAndroidKeystoreExportAdminKey` |
| Legacy Edge Admin Key | SecureStore | tokenStore helpers | `saveLegacyEdgeAdminKey` |
| Signing Admin Key | SecureStore | tokenStore helpers | `saveSigningAdminKey` |
| Supabase Service Role Key | SecureStore (legacy AsyncStorage migration) | tokenStore helpers | `saveSupabaseServiceRoleKey` |
| Signing Master Key | SecureStore | tokenStore helpers | `saveSigningMasterKey` |

---

## B) SoT + Ownership (Single Writer Contract)

## B.1 Verbindliche SoT-Entscheidung

1. **Repo/Branch/BuildProfile SoT = `ProjectData`**
   - `linkedRepo`, `linkedBranch`, `preferredBuildProfile` sind die autoritativen Werte.
2. **GitHubContext `active*` = abgeleitetes Read-Model**
   - darf UI bedienen, hat aber keine eigene Persistenz- oder Business-SoT.
3. **Sensitive Keys SoT = SecureStore (über tokenStore/githubService APIs)**
   - kein Klartext-SoT in AsyncStorage.
4. **Status-Lampen/Read-Model-Flags SoT = AsyncStorage keys**
   - Connection, Diagnostic, CI-Lite, Wizard-Exists, Build-History, Chat-Privacy.

## B.2 Single Writer Regeln (Soll-Contract)

- **Repo/Branch:** nur `ProjectContext.setLinkedRepo(...)` ist autoritativer Writer.
- **Build Profile:** nur `ProjectContext.setPreferredBuildProfile(...)`.
- **Tokens/Secrets:** nur `infra/github/tokenStore.ts` (`save*/delete*`).
- **Scoped lokale Admin-Keys:** Workflow (`workflowAdminKey`) und Android Keystore Export (`androidKeystoreExportAdminKey`) bleiben getrennte SecureStore-Slots; `legacyEdgeAdminKey` ist nur Compat-/Sunset-Slot und im Preview-Vertrag (Patch 615) **kein Standardpfad** mehr: `save_preview` darf nur noch bei explizitem Operator-/Maintenance-Flag (`EXPO_PUBLIC_ENABLE_LEGACY_PREVIEW_OPERATOR_MODE=true`) genutzt werden.
- **Operator-Claim ist externer Betriebsvertrag:** `build_admin` wird ausserhalb des Repos provisioniert; App-/Repo-Code simuliert diesen Claim bewusst nicht.
- **Connection-Lampen:** nur `useConnectionsScreen` schreibt `CONN_*` und `EAS_PROJECT_ID` (außer klar definierte Import-Flows).
- **Wizard key-exists Flags:** nur `useCredentialsWizardScreen.refreshStatusCore(...)`.
- **Diagnostic/CI Lite Flags:** nur Diagnostic-Run und CI-Lite Workflow Hook.

## B.3 Aktuelle Abweichungen (Ist vs Soll)

- Keine konkurrierende Dual-SoT fuer Repo/Branch mehr: Write-Pfade laufen ueber `setLinkedRepo(...)`.
- Legacy-Backups mit `github.activeRepo/activeBranch` werden beim Import kontrolliert auf `github.linkedRepo/linkedBranch` migriert.

---

## C) Persistenz & Hydration

## C.1 Reihenfolge (Boot + Laufzeit)

1. `ProjectContext` lädt `k1w1_project_data` und setzt `projectData`.
2. `GitHubContext` lädt `recentRepos` und bereinigt Legacy-`active*`-Keys;
   `activeRepo`/`activeBranch` werden direkt aus `projectData.linked*` abgeleitet.
3. Feature-Hooks laden ihre Read-Model-Flags aus AsyncStorage:
   - Connections Lampen,
   - Build Preconditions (Wizard/Diagnostic/CI Lite),
   - One-Click Optionen,
   - Chat Privacy Settings.
4. SecureStore-basierte Secrets werden über service/helper APIs geladen.

## C.2 Persistenzgrenzen

- **Projektweite Domäne** (`ProjectData`) wird als ein JSON-Blob gespeichert (`k1w1_project_data`).
- **Feature-Flags/Lights** bleiben absichtlich als separate AsyncStorage Keys.
- **Secrets** bleiben in SecureStore; Legacy AsyncStorage Service-Role-Key wird migriert und entfernt.

---

## D) Invarianten (MUST-Regeln)

1. **Repo/Branch Konsistenz:** `projectData.linkedRepo/linkedBranch` sind app-weit verbindlich; Header, Drawer, Build, Diagnostic, Wizard müssen denselben Stand zeigen.
2. **Profile Konsistenz:** `preferredBuildProfile` ist global eindeutig (`development|preview|production`) und Wizard/Build/Drawer spiegeln denselben Wert.
3. **Credential Scope:** `CRED_KEY_EXISTS_*` wird immer profil-spezifisch gelesen/geschrieben (kein profilfremder Reuse).
4. **Diagnostic Gate:** Build-Preconditions dürfen `DIAGNOSTIC_LAST_OK` nur als Read-Model lesen, nicht selbst schreiben.
5. **CI Lite Gate:** CI-Lite-Flags werden ausschließlich durch CI-Lite Runabschluss gesetzt.
6. **Secrets niemals Async SoT:** GitHub/Expo/Edge/Supabase Service Role/Signing Master sind SecureStore-first.
7. **Restart-Stabilität Lampen:** `CONN_*` Status muss nach Restart erhalten bleiben, bis explizit neu getestet/überschrieben.
8. **Keine stille Branch-Erfindung im kritischen Pfad:** kein implizites `"main"` als versteckter Hard-Fallback in Build-kritischen Entscheidungen.

---

## E) Anti-Patterns & verbotene Fallbacks

1. **Dual Writer auf denselben fachlichen Zustand** (`active*` + `linked*` unabhängig setzen).
2. **Silent Fallback auf `"main"`** in Build/CI-relevanten Flows ohne sichtbaren User-Intent.
3. **Secrets in AsyncStorage als dauerhafte Wahrheit** (nur Migration erlaubt, danach entfernen).
4. **Screen-lokale Wahrheit für globale Auswahl** (z. B. lokales Profil ohne Rückschreiben nach `ProjectData`).
5. **Read-Model Keys als Business-SoT missbrauchen** (z. B. `CONN_REPO_*` statt `linkedRepo/linkedBranch` für Kernlogik).

---

## Evidence (Datei + Symbol + kurzer Auszug)

### E1 — SoT Repo/Branch/Profile in ProjectContext
**Datei:** `contexts/ProjectContext.tsx` — **Symbole:** `setLinkedRepo`, `setPreferredBuildProfile`
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

### E2 — GitHubContext als Derived Read-Model aus `projectData.linked*`
**Datei:** `contexts/GitHubContext.tsx` — **Symbole:** `activeRepo`, `activeBranch`
```ts
const activeRepo = useMemo(
  () => (hydrated ? normalizeLinkedGitHubValue(projectData?.linkedRepo) : null),
  [hydrated, projectData?.linkedRepo],
);
const activeBranch = useMemo(
  () => (hydrated ? normalizeLinkedGitHubValue(projectData?.linkedBranch) : null),
  [hydrated, projectData?.linkedBranch],
);
```

### E3 — Persistenz von `ProjectData` als JSON-Blob
**Datei:** `infra/storage/projectPersistence.ts` — **Symbole:** `saveProjectToStorage`, `loadProjectFromStorage`
```ts
const projectString = JSON.stringify(projectToSave);
await AsyncStorage.setItem(PROJECT_STORAGE_KEY, projectString);

const projectString = await AsyncStorage.getItem(PROJECT_STORAGE_KEY);
if (!projectString) return null;
const project = JSON.parse(projectString);
```

### E4 — Connection Lampen & EAS ID werden persistent geladen
**Datei:** `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts` — **Symbol:** mount hydration
```ts
const [ghOk, ghUserStored, ghScopesStored, sbOk, sbRefStored, exOk, exUserStored, easOkStored, repoOkStored, repoSlug, repoBranch] = await Promise.all([
  AsyncStorage.getItem(STORAGE_KEYS.CONN_GITHUB_OK).catch(() => null),
  AsyncStorage.getItem(STORAGE_KEYS.CONN_GITHUB_USER).catch(() => null),
  AsyncStorage.getItem(STORAGE_KEYS.CONN_GITHUB_SCOPES).catch(() => null),
  AsyncStorage.getItem(STORAGE_KEYS.CONN_SUPABASE_OK).catch(() => null),
  AsyncStorage.getItem(STORAGE_KEYS.CONN_SUPABASE_REF).catch(() => null),
  AsyncStorage.getItem(STORAGE_KEYS.CONN_EXPO_OK).catch(() => null),
  AsyncStorage.getItem(STORAGE_KEYS.CONN_EXPO_USER).catch(() => null),
  AsyncStorage.getItem(STORAGE_KEYS.CONN_EAS_OK).catch(() => null),
  AsyncStorage.getItem(STORAGE_KEYS.CONN_REPO_OK).catch(() => null),
]);
```

### E5 — Credentials Wizard schreibt profil-spezifische `CRED_KEY_EXISTS_*`
**Datei:** `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts` — **Symbol:** `refreshStatusCore`
```ts
const data = r.data as StatusResult;
if (isMountedRef.current) setStatusByMode((prev) => ({ ...prev, [mode]: data }));
// Persist key status
const credKey = credKeyForUiMode(mode);
await AsyncStorage.setItem(credKey, data.exists ? "true" : "false").catch(() => {});
```

### E6 — Build Preconditions lesen Wizard/Diagnostic/CI-Lite Flags
**Datei:** `screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts` — **Symbol:** `refreshPreconditions`
```ts
const val = await AsyncStorage.getItem(credKey).catch(() => null);
if (isMountedRef.current) setHasSigningKey(val === "true");

const diagVal = await AsyncStorage.getItem(STORAGE_KEYS.DIAGNOSTIC_LAST_OK).catch(() => null);
if (isMountedRef.current) setHasDiagOk(diagVal === "true");

const [lintOk, typeOk] = await Promise.all([
  AsyncStorage.getItem(STORAGE_KEYS.CI_LITE_LINT_OK).catch(() => null),
  AsyncStorage.getItem(STORAGE_KEYS.CI_LITE_TYPECHECK_OK).catch(() => null),
]);
```

### E7 — Diagnostic schreibt `DIAGNOSTIC_LAST_OK`
**Datei:** `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts` — **Symbol:** `runDiagnostics` Ende
```ts
const hasFails = all.some((r) => r.status === "fail");
await AsyncStorage
  .setItem(STORAGE_KEYS.DIAGNOSTIC_LAST_OK, hasFails ? "false" : "true")
  .catch(() => {});
```

### E8 — CI Lite schreibt `CI_LITE_*`
**Datei:** `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts` — **Symbol:** persist effect
```ts
void AsyncStorage.multiSet([
  [STORAGE_KEYS.CI_LITE_LINT_OK, lintOk ? "true" : "false"],
  [STORAGE_KEYS.CI_LITE_TYPECHECK_OK, typeOk ? "true" : "false"],
  [STORAGE_KEYS.CI_LITE_LAST_RUN_AT, String(Date.now())],
]).catch(() => {});
```

### E9 — Chat Settings Defaults + Persistenz
**Datei:** `lib/chatPrivacySettings.ts` — **Symbole:** `DEFAULT_*`, getter/setter
```ts
const DEFAULT_PERSIST = true;
const DEFAULT_RETENTION = 200;

const raw = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_PERSIST_HISTORY);
await AsyncStorage.setItem(STORAGE_KEYS.CHAT_PERSIST_HISTORY, enabled ? "1" : "0");

const raw = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_RETENTION_LIMIT);
await AsyncStorage.setItem(STORAGE_KEYS.CHAT_RETENTION_LIMIT, String(safeLimit));
```

### E10 — Build History Persistenz
**Datei:** `lib/buildHistoryStorage.ts` — **Symbole:** `loadBuildHistory`, `saveBuildHistory`
```ts
const historyString = await AsyncStorage.getItem(STORAGE_KEYS.BUILD_HISTORY);
if (!historyString) {
  return [];
}

const trimmedHistory = history.slice(0, MAX_HISTORY_ENTRIES);
const historyString = JSON.stringify(trimmedHistory);
await AsyncStorage.setItem(STORAGE_KEYS.BUILD_HISTORY, historyString);
```

### E11 — SecureStore als SoT für sensitive Keys
**Datei:** `infra/github/tokenStore.ts` — **Symbole:** `saveSecureToken/getSecureToken`, Service Role section
```ts
await SecureStore.setItemAsync(key, value);
return await SecureStore.getItemAsync(key);

export const getSupabaseServiceRoleKey = async (): Promise<string | null> => {
  return getSecureToken(SUPABASE_SERVICE_ROLE_KEY);
};
```

### E12 — Backup-Import schreibt nur noch die autoritative Repo/Branch-SoT
**Datei:** `screens/AppInfoScreen/hooks/useAppInfoScreen.ts` — **Symbol:** `applySecretBackupPayload`
```ts
setLinkedRepo(payload.github.linkedRepo, payload.github.linkedBranch);
```

### E13 — Aktuelle Abweichung: Branch-Fallback auf "main"
**Datei:** `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts` — **Symbol:** EAS link flow branch resolution
```ts
const branch =
  (activeBranch || projectData?.linkedBranch || "main").trim() || "main";
```
