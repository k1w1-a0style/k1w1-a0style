import { useMemo } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";

import { useGitHub } from "../../../contexts/GitHubContext";
import { useProject } from "../../../contexts/ProjectContext";
import { resolveRepoBranchSelection } from "../../../lib/selection/repoBranch";
import { useConnectionsBusyAction } from "./useConnectionsBusyAction";
import { useConnectionsEasLink } from "./useConnectionsEasLink";
import { useConnectionsHydration } from "./useConnectionsHydration";
import { useConnectionsProviderTests } from "./useConnectionsProviderTests";
import { useConnectionsSecretsState } from "./useConnectionsSecretsState";
import { useConnectionsPersistence } from "./useConnectionsPersistence";
import { useConnectionsSaveActions } from "./useConnectionsSaveActions";
import { useConnectionsStatusModel } from "./useConnectionsStatusModel";
import { useConnectionsDerivedEffects } from "./useConnectionsDerivedEffects";
import { useConnectionsEasProjectIdPersistence } from "./useConnectionsEasProjectIdPersistence";
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

  const persistSelectedEasProjectId = useConnectionsEasProjectIdPersistence();

  const { hydrated, didAutoTestEas } = useConnectionsHydration({
    selectedRepo: effectiveRepo,
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
    effectiveRepo,
    clearGithubConnectionState: persistence.actions.clearGithubConnectionState,
    clearExpoConnectionState: persistence.actions.clearExpoConnectionState,
    clearEasConnectionState: persistence.actions.clearEasConnectionState,
    clearSupabaseConnectionState: persistence.actions.clearSupabaseConnectionState,
    applyEasConnectionState: persistence.actions.applyEasConnectionState,
    setSupabaseConnectionState: (status) => {
      persistence.setters.setSupabaseOk(status.ok);
      persistence.setters.setSupabaseRef(status.ref);
    },
  });

  useConnectionsDerivedEffects({
    hydrated,
    didAutoTestEas,
    expoToken: secrets.expoToken,
    easProjectId: secrets.easProjectId,
    testEas,
    supabaseRaw: secrets.supabaseRaw,
    setSupabaseUrl: secrets.setSupabaseUrl,
  });

  const { status, githubConnected } = useConnectionsStatusModel({
    githubToken: secrets.githubToken,
    expoToken: secrets.expoToken,
    workflowAdminKey: secrets.workflowAdminKey,
    androidKeystoreExportAdminKey: secrets.androidKeystoreExportAdminKey,
    supabaseUrl: secrets.supabaseUrl,
    supabaseAnonKey: secrets.supabaseAnonKey,
    easProjectId: secrets.easProjectId,
    linkedRepo: projectData?.linkedRepo,
    activeRepo,
  });

  return {
    navigation,
    ui: {
      busy,
      hydrated,
      isTestingEas,
      isEasInitRunning,
    },
    connection: {
      githubConnected,
      githubOk: persistence.state.githubOk,
      githubUser: persistence.state.githubUser,
      githubScopes: persistence.state.githubScopes,
      supabaseOk: persistence.state.supabaseOk,
      supabaseRef: persistence.state.supabaseRef,
      expoOk: persistence.state.expoOk,
      expoUser: persistence.state.expoUser,
      easOk: persistence.state.easOk,
      status,
      repoLine,
      selectionSource,
    },
    tokens: {
      githubToken: secrets.githubToken,
      setGithubToken: secrets.setGithubToken,
      expoToken: secrets.expoToken,
      setExpoToken: secrets.setExpoToken,
      workflowAdminKey: secrets.workflowAdminKey,
      setWorkflowAdminKey: secrets.setWorkflowAdminKey,
      androidKeystoreExportAdminKey: secrets.androidKeystoreExportAdminKey,
      setAndroidKeystoreExportAdminKey: secrets.setAndroidKeystoreExportAdminKey,
    },
    visibility: {
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
    },
    supabase: {
      supabaseRaw: secrets.supabaseRaw,
      setSupabaseRaw: secrets.setSupabaseRaw,
      supabaseUrl: secrets.supabaseUrl,
      setSupabaseUrl: secrets.setSupabaseUrl,
      supabaseAnonKey: secrets.supabaseAnonKey,
      setSupabaseAnonKey: secrets.setSupabaseAnonKey,
    },
    eas: {
      activeRepo: effectiveRepo,
      easProjectId: secrets.easProjectId,
      setEasProjectId: secrets.setEasProjectId,
      easState: persistence.state.easState,
      easLastVerifiedAt: persistence.state.easLastVerifiedAt,
      testEas,
      onLinkExisting,
      onCreateAndLink,
    },
    actions: {
      saveAll,
      testGitHub,
      testSupabase,
      testExpo,
    },
  };
}
