import { useCallback, useEffect, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";

import { STORAGE_KEYS } from "../../../lib/storageKeys";
import { useGitHub } from "../../../contexts/GitHubContext";
import { useProject } from "../../../contexts/ProjectContext";
import { resolveRepoBranchSelection } from "../../../lib/selection/repoBranch";
import { resolveConnectionsStatusFlags, resolveEasProjectIdPersistenceAction } from "./useConnectionsScreenHelpers";
import { deriveSupabaseUrl } from "../utils/validation";
import { useConnectionsBusyAction } from "./useConnectionsBusyAction";
import { useConnectionsEasLink } from "./useConnectionsEasLink";
import { useConnectionsHydration } from "./useConnectionsHydration";
import { useConnectionsProviderTests } from "./useConnectionsProviderTests";
import { useConnectionsSecretsState } from "./useConnectionsSecretsState";
import { useConnectionsPersistence } from "./useConnectionsPersistence";
import { useConnectionsSaveActions } from "./useConnectionsSaveActions";
import type { UseConnectionsScreenReturn } from "./connections.contracts";

export function useConnectionsScreen(): UseConnectionsScreenReturn {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { activeRepo, activeBranch } = useGitHub();
  const { projectData } = useProject();

  const secrets = useConnectionsSecretsState();
  const { busy, busyRef, runGuardedAction } = useConnectionsBusyAction();
  const persistence = useConnectionsPersistence();

  const selection = useMemo(
    () => resolveRepoBranchSelection({ projectData, activeRepo, activeBranch }),
    [projectData, activeRepo, activeBranch],
  );
  const repoLine = selection.repoLine;
  const effectiveRepo = selection.repo || null;
  const effectiveBranch = selection.branch || null;
  const selectionSource = selection.source;

  const persistSelectedEasProjectId = useCallback(async (projectId: string) => {
    const persistenceAction = resolveEasProjectIdPersistenceAction(projectId);
    if (persistenceAction.mode === "set") {
      await AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, persistenceAction.value);
      return;
    }
    await AsyncStorage.removeItem(STORAGE_KEYS.EAS_PROJECT_ID);
  }, []);

  const { hydrated, didAutoTestEas } = useConnectionsHydration({
    expoToken: secrets.expoToken,
    setGithubToken: secrets.setGithubToken,
    setExpoToken: secrets.setExpoToken,
    setWorkflowAdminKey: secrets.setWorkflowAdminKey,
    setAndroidKeystoreExportAdminKey: secrets.setAndroidKeystoreExportAdminKey,
    setSupabaseRaw: secrets.setSupabaseRaw,
    setSupabaseUrl: secrets.setSupabaseUrl,
    setSupabaseAnonKey: secrets.setSupabaseAnonKey,
    setEasProjectId: secrets.setEasProjectId,
    setGithubOk: persistence.setters.setGithubOk,
    setGithubUser: persistence.setters.setGithubUser,
    setGithubScopes: persistence.setters.setGithubScopes,
    setSupabaseOk: persistence.setters.setSupabaseOk,
    setSupabaseRef: persistence.setters.setSupabaseRef,
    setExpoOk: persistence.setters.setExpoOk,
    setExpoUser: persistence.setters.setExpoUser,
    setRepoOk: persistence.setters.setRepoOk,
    setRepoOkLine: persistence.setters.setRepoOkLine,
    applyEasConnectionState: persistence.actions.applyEasConnectionState,
    persistConnLights: persistence.actions.persistConnLights,
    removeConnLights: persistence.actions.removeConnLights,
  });

  const { testGitHub, testExpo, testSupabase, testEas, isTestingEas } = useConnectionsProviderTests({
    hydrated,
    githubToken: secrets.githubToken,
    expoToken: secrets.expoToken,
    supabaseUrl: secrets.supabaseUrl,
    supabaseAnonKey: secrets.supabaseAnonKey,
    easProjectId: secrets.easProjectId,
    runGuardedAction,
    logConnectionFailure: persistence.actions.logConnectionFailure,
    applyGitHubPersistence: persistence.actions.applyGitHubPersistence,
    applyExpoPersistence: persistence.actions.applyExpoPersistence,
    applySupabasePersistence: persistence.actions.applySupabasePersistence,
    saveConnEasStatus: persistence.actions.saveConnEasStatus,
  });

  const { isEasInitRunning, onLinkExisting, onCreateAndLink } = useConnectionsEasLink({
    hydrated,
    easProjectId: secrets.easProjectId,
    githubToken: secrets.githubToken,
    effectiveRepo,
    effectiveBranch,
    busyRef,
    persistSelectedEasProjectId,
    persistConnLights: persistence.actions.persistConnLights,
    removeConnLights: persistence.actions.removeConnLights,
    applyEasConnectionState: persistence.actions.applyEasConnectionState,
    setRepoOk: persistence.setters.setRepoOk,
    setRepoOkLine: persistence.setters.setRepoOkLine,
  });

  const { saveAll } = useConnectionsSaveActions({
    hydrated,
    runGuardedAction,
    secrets: {
      githubToken: secrets.githubToken,
      expoToken: secrets.expoToken,
      workflowAdminKey: secrets.workflowAdminKey,
      androidKeystoreExportAdminKey: secrets.androidKeystoreExportAdminKey,
      supabaseRaw: secrets.supabaseRaw,
      supabaseUrl: secrets.supabaseUrl,
      supabaseAnonKey: secrets.supabaseAnonKey,
      easProjectId: secrets.easProjectId,
    },
    persistSelectedEasProjectId,
    clearGithubConnectionState: persistence.actions.clearGithubConnectionState,
    clearExpoConnectionState: persistence.actions.clearExpoConnectionState,
    clearEasConnectionState: persistence.actions.clearEasConnectionState,
    clearSupabaseConnectionState: persistence.actions.clearSupabaseConnectionState,
  });

  useEffect(() => {
    if (!hydrated) return;
    if (didAutoTestEas.current) return;
    if (!secrets.expoToken.trim()) return;
    if (!secrets.easProjectId.trim()) return;
    didAutoTestEas.current = true;
    void testEas();
  }, [hydrated, didAutoTestEas, secrets.expoToken, secrets.easProjectId, testEas]);

  useEffect(() => {
    const d = deriveSupabaseUrl(secrets.supabaseRaw);
    if (d.url) secrets.setSupabaseUrl(d.url);
  }, [secrets.supabaseRaw, secrets.setSupabaseUrl]);

  const status = useMemo(
    () =>
      resolveConnectionsStatusFlags({
        githubToken: secrets.githubToken,
        expoToken: secrets.expoToken,
        workflowAdminKey: secrets.workflowAdminKey,
        androidKeystoreExportAdminKey: secrets.androidKeystoreExportAdminKey,
        supabaseUrl: secrets.supabaseUrl,
        supabaseAnonKey: secrets.supabaseAnonKey,
        linkedRepo: projectData?.linkedRepo,
        activeRepo,
        easProjectId: secrets.easProjectId,
      }),
    [
      secrets.githubToken,
      secrets.expoToken,
      secrets.workflowAdminKey,
      secrets.androidKeystoreExportAdminKey,
      secrets.supabaseUrl,
      secrets.supabaseAnonKey,
      secrets.easProjectId,
      projectData?.linkedRepo,
      activeRepo,
    ],
  );

  const githubConnected = !!secrets.githubToken.trim();

  return {
    navigation,
    busy,
    hydrated,
    githubConnected,
    isEasInitRunning,
    activeRepo: effectiveRepo,
    onLinkExisting,
    onCreateAndLink,
    githubOk: persistence.state.githubOk,
    githubUser: persistence.state.githubUser,
    githubScopes: persistence.state.githubScopes,
    supabaseOk: persistence.state.supabaseOk,
    expoOk: persistence.state.expoOk,
    expoUser: persistence.state.expoUser,
    repoOk: persistence.state.repoOk,
    repoOkLine: persistence.state.repoOkLine,
    supabaseRef: persistence.state.supabaseRef,
    status,
    repoLine,
    selectionSource,
    supabaseUrl: secrets.supabaseUrl,
    githubToken: secrets.githubToken,
    setGithubToken: secrets.setGithubToken,
    expoToken: secrets.expoToken,
    setExpoToken: secrets.setExpoToken,
    workflowAdminKey: secrets.workflowAdminKey,
    setWorkflowAdminKey: secrets.setWorkflowAdminKey,
    androidKeystoreExportAdminKey: secrets.androidKeystoreExportAdminKey,
    setAndroidKeystoreExportAdminKey: secrets.setAndroidKeystoreExportAdminKey,
    showGitHub: secrets.showGitHub,
    setShowGitHub: secrets.setShowGitHub,
    showExpo: secrets.showExpo,
    setShowExpo: secrets.setShowExpo,
    showWorkflowAdmin: secrets.showWorkflowAdmin,
    setShowWorkflowAdmin: secrets.setShowWorkflowAdmin,
    showKeystoreAdmin: secrets.showKeystoreAdmin,
    setShowKeystoreAdmin: secrets.setShowKeystoreAdmin,
    showSupabaseAnon: secrets.showSupabaseAnon,
    setShowSupabaseAnon: secrets.setShowSupabaseAnon,
    supabaseRaw: secrets.supabaseRaw,
    setSupabaseRaw: secrets.setSupabaseRaw,
    setSupabaseUrl: secrets.setSupabaseUrl,
    supabaseAnonKey: secrets.supabaseAnonKey,
    setSupabaseAnonKey: secrets.setSupabaseAnonKey,
    easOk: persistence.state.easOk,
    easState: persistence.state.easState,
    easLastVerifiedAt: persistence.state.easLastVerifiedAt,
    easProjectId: secrets.easProjectId,
    setEasProjectId: secrets.setEasProjectId,
    saveAll,
    testGitHub,
    testSupabase,
    testExpo,
    testEas,
    isTestingEas,
  };
}
