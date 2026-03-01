# 03 — Screen Index (nur Navigationshilfe)

> Diese Datei ist bewusst ein Index. Der normative Vertrag steht in 01/02.

## Matrix: Screen → liest/setzt Contract-Werte

| Screen/Hook | Liest | Setzt | Bemerkung |
|---|---|---|---|
| `GitHubReposScreen` (`useGitHubReposScreen`) | `activeRepo/activeBranch`, `projectData.linkedRepo/linkedBranch`, `EAS_PROJECT_ID` | `setActiveRepo`, `setActiveBranch`, `setLinkedRepo` | Primärer Repo/Branch-Auswahlpunkt; aktuell Dual-Write. |
| `EnhancedBuildScreen` (`useEnhancedBuildScreen`) | `projectData.linkedRepo/linkedBranch`, `preferredBuildProfile`, `activeBranch`, Diagnostic/CI-Flags (via preconditions) | `setPreferredBuildProfile`, `startBuild` | Repo/Branch dort read-only gedacht; Buildstart hier. |
| `DiagnosticScreen` (`useDiagnosticScreen`) | `linkedRepo/linkedBranch`, `preferredBuildProfile` | `DIAGNOSTIC_LAST_OK`, optional `setPreferredBuildProfile` | Schreibt Diagnostik-Status persistiert. |
| `ConnectionsScreen` (`useConnectionsScreen`) | `activeBranch`, `projectData.linkedBranch`, `EAS_PROJECT_ID`, Repo-Auswahl | `EAS_PROJECT_ID`, Connection-Lights (`CONN_*`) | EAS Link/Create dispatch; nutzt branch fallback. |
| `CredentialsWizardScreen` (`useCredentialsWizardScreen`) | `linkedRepo/linkedBranch`, `preferredBuildProfile` | `setPreferredBuildProfile` | Build-Mode ist an globales preferred profile gekoppelt. |
| `AppInfoScreen` (`useAppInfoScreen`) | Backup-Daten inkl. GitHub active values | `setActiveRepo`, `setActiveBranch`, `setLinkedRepo`, `EAS_PROJECT_ID` | Import-Flow kann SoT + Mirror gleichzeitig überschreiben. |

---

## Evidence

### Evidence A — RepoScreen schreibt active* + linked*
**Datei:** `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`  
**Symbol:** `handleSelectRepo`, `handleSelectBranch`
```ts
setActiveRepo(fullName);
// ...
setActiveBranch(defaultBranch);
setLinkedRepo(fullName, defaultBranch);

setActiveBranch(branch);
if (activeRepo) {
  setLinkedRepo(activeRepo, branch);
}
```

### Evidence B — BuildScreen liest linked* und setzt BuildProfile
**Datei:** `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts`  
**Symbol:** `repoFullName`, `branchName`, `onSelectBuildProfile`
```ts
const repoFullName = useMemo(() => {
  return projectData?.linkedRepo?.trim() || ...;
}, [projectData?.linkedRepo, currentBuild?.githubRepo]);

const branchName = useMemo(() => {
  return projectData?.linkedBranch?.trim() || activeBranch?.trim() || ...;
}, [projectData?.linkedBranch, activeBranch, currentBuild?.branch]);

if (setPreferredBuildProfile) await setPreferredBuildProfile(p);
```

### Evidence C — Diagnostics schreibt DIAGNOSTIC_LAST_OK
**Datei:** `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts`  
**Symbol:** Abschluss des Check-Runs
```ts
const hasFails = all.some((r) => r.status === "fail");
await AsyncStorage.setItem(
  STORAGE_KEYS.DIAGNOSTIC_LAST_OK,
  hasFails ? "false" : "true",
).catch(() => {});
```

### Evidence D — Connections persistiert EAS_PROJECT_ID
**Datei:** `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`  
**Symbol:** `runLink`
```ts
if (projectId) {
  await AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, projectId).catch(() => null);
} else {
  await AsyncStorage.removeItem(STORAGE_KEYS.EAS_PROJECT_ID).catch(() => null);
}
```

### Evidence E — AppInfo Import setzt SoT + Mirror
**Datei:** `screens/AppInfoScreen/hooks/useAppInfoScreen.ts`  
**Symbol:** Import-Pfad
```ts
setActiveRepo(nextRepo);
setActiveBranch(nextBranch);
// ...
setLinkedRepo(nextRepo, nextBranch);
```
