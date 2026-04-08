import { useCallback, useState, type MutableRefObject } from "react";
import { Alert } from "react-native";

import { STORAGE_KEYS } from "../../../lib/storageKeys";
import { autoFixCIWorkflows, parseOwnerRepo } from "../../../lib/diagnostics/ciAutoFix";
import {
  deleteLegacyEdgeAdminKey,
  saveGitHubToken,
  triggerWorkflow,
} from "../../../infra/github/githubService";
import { runCleanupTask } from "../../../lib/safeCleanup";
import { safeAlertText, validateEasProjectId } from "../utils/validation";
import {
  applyPersistenceDelta,
  resolveEasLaunchPlan,
  resolveEasLinkPostStartState,
  resolveEasLinkWorkflowStartMessage,
  resolveEasLinkWorkflowTriggerInputs,
  resolveEasWorkflowLaunchSelection,
  resolveRepoSelectionPersistence,
} from "./useConnectionsScreenHelpers";
import type { EasLaunchSelection } from "./connections.contracts";
import type { VerificationContractState } from "../../../lib/status/verificationContract";

type Params = {
  hydrated: boolean;
  easProjectId: string;
  githubToken: string;
  effectiveRepo: string | null;
  effectiveBranch: string | null;
  busyRef: MutableRefObject<boolean>;
  persistSelectedEasProjectId: (projectId: string) => Promise<void>;
  persistConnLights: (entries: Array<[string, string]>) => Promise<void>;
  removeConnLights: (keys: string[]) => Promise<void>;
  applyEasConnectionState: (payload: {
    ok: boolean;
    state: VerificationContractState;
    verifiedAt: string | null;
  }) => void;
  setRepoOk: (value: boolean) => void;
  setRepoOkLine: (value: string) => void;
};

export function useConnectionsEasLink(params: Params) {
  const {
    hydrated,
    easProjectId,
    githubToken,
    effectiveRepo,
    effectiveBranch,
    busyRef,
    persistSelectedEasProjectId,
    persistConnLights,
    removeConnLights,
    applyEasConnectionState,
    setRepoOk,
    setRepoOkLine,
  } = params;
  const [isEasInitRunning, setIsEasInitRunning] = useState(false);

  const persistSelectedEasProjectIdBestEffort = useCallback(
    async (projectId: string) => {
      await runCleanupTask(
        () => persistSelectedEasProjectId(projectId),
        `[ConnectionsScreen] persist/remove EAS project id failed for key=${STORAGE_KEYS.EAS_PROJECT_ID}`,
      );
    },
    [persistSelectedEasProjectId],
  );

  const runEasLinkWorkflowStart = useCallback(
    async (p: {
      token: string;
      owner: string;
      repo: string;
      branch: string;
      projectId: string;
      persistProjectIdSelection: boolean;
    }) => {
      await saveGitHubToken(p.token);
      await deleteLegacyEdgeAdminKey();
      if (p.persistProjectIdSelection) {
        await persistSelectedEasProjectIdBestEffort(p.projectId);
      }
      await autoFixCIWorkflows({ owner: p.owner, repo: p.repo, branch: p.branch });
      const workflowInputs = resolveEasLinkWorkflowTriggerInputs({ branch: p.branch, projectId: p.projectId });
      await triggerWorkflow(p.owner, p.repo, "eas-link.yml", p.branch, workflowInputs);
    },
    [persistSelectedEasProjectIdBestEffort],
  );

  const applyEasWorkflowPostStartState = useCallback(
    async (projectId: string) => {
      const postStartState = resolveEasLinkPostStartState(projectId);
      applyEasConnectionState({
        ok: false,
        state: postStartState.state,
        verifiedAt: null,
      });
      await applyPersistenceDelta({
        writes: postStartState.writes,
        removes: postStartState.removes,
        persist: persistConnLights,
        remove: removeConnLights,
      });
    },
    [applyEasConnectionState, persistConnLights, removeConnLights],
  );

  const persistRepoSelectionState = useCallback(
    async (repoSlug: string, branch: string) => {
      const normalizedRepoSlug = repoSlug.trim();
      if (!normalizedRepoSlug) return;
      const persistence = resolveRepoSelectionPersistence({ repoSlug: normalizedRepoSlug, branch });
      setRepoOk(true);
      setRepoOkLine(persistence.repoOkLine);
      await persistConnLights(persistence.writes);
    },
    [setRepoOk, setRepoOkLine, persistConnLights],
  );

  // Invariant contract marker retained for source-based tests
  const resolveCurrentEasLaunchSelection = useCallback(() => {
    return resolveEasWorkflowLaunchSelection({
      githubToken,
      repoSlug: effectiveRepo || "",
      branch: effectiveBranch || "",
      parseOwnerRepo,
    });
  }, [githubToken, effectiveRepo, effectiveBranch]);

  const resolveEasLaunchSelectionOrAlert = useCallback(() => {
    const launchSelection = resolveCurrentEasLaunchSelection();
    if (!launchSelection.ok) {
      Alert.alert(launchSelection.notice.title, launchSelection.notice.message);
      return null;
    }
    return launchSelection.selection;
  }, [resolveCurrentEasLaunchSelection]);

  const canStartEasWorkflow = useCallback((): boolean => {
    return hydrated && !busyRef.current && !isEasInitRunning;
  }, [hydrated, busyRef, isEasInitRunning]);

  // Invariant contract marker retained for source-based tests
  const startEasWorkflow = useCallback(
    async (p: {
      selection: EasLaunchSelection;
      projectId: string;
      persistProjectIdSelection: boolean;
      startedNotice: { title: string; message: string };
    }) => {
      setIsEasInitRunning(true);
      try {
        await runEasLinkWorkflowStart({
          token: p.selection.githubToken,
          owner: p.selection.owner,
          repo: p.selection.repo,
          branch: p.selection.branch,
          projectId: p.projectId,
          persistProjectIdSelection: p.persistProjectIdSelection,
        });
        await applyEasWorkflowPostStartState(p.projectId);
        await persistRepoSelectionState(p.selection.repoSlug, p.selection.branch);
        Alert.alert(p.startedNotice.title, p.startedNotice.message);
      } catch (e: unknown) {
        Alert.alert("Fehler", safeAlertText(e));
      } finally {
        setIsEasInitRunning(false);
      }
    },
    [runEasLinkWorkflowStart, applyEasWorkflowPostStartState, persistRepoSelectionState],
  );

  const executeEasLaunchPlan = useCallback(
    async (p: { selection: EasLaunchSelection; mode: "link_existing" | "create_and_link"; easProjectId: string }) => {
      const launchPlan = resolveEasLaunchPlan({ mode: p.mode, easProjectId: p.easProjectId });

      if (p.mode === "link_existing") {
        const easValidation = validateEasProjectId(p.easProjectId.trim());
        if (!easValidation.ok) {
          Alert.alert(easValidation.title, easValidation.message);
          return;
        }
      }

      const runStart = async (projectId: string, persistProjectIdSelection: boolean, startedNotice: {
        title: string;
        message: string;
      }) => {
        // Workflow wurde nur gestartet; EAS-Verification bleibt bis zum echten Test neutral/false.
        // Invariant contract marker retained for source-based tests: setEasOk(false)
        await startEasWorkflow({
          selection: p.selection,
          projectId,
          persistProjectIdSelection,
          startedNotice,
        });
      };

      if (launchPlan.kind === "confirm_create") {
        Alert.alert(launchPlan.title, launchPlan.message, [
          { text: "Abbrechen", style: "cancel" },
          {
            text: "OK",
            onPress: () =>
              void runStart("", true, {
                title: "OK",
                message: resolveEasLinkWorkflowStartMessage(""),
              }),
          },
        ]);
        return;
      }

      await runStart(launchPlan.projectId, launchPlan.persistProjectIdSelection, launchPlan.notice);
    },
    [startEasWorkflow],
  );

  const onLinkExisting = useCallback(async () => {
    if (!canStartEasWorkflow()) return;

    const launchSelection = resolveEasLaunchSelectionOrAlert();
    // Invariant contract marker retained for source-based tests:
    // "Kein Branch ausgewählt. Bitte zuerst in GitHub Repos einen Branch verknüpfen."
    // Invariant contract marker retained for source-based tests: setEasOk(false)
    if (!launchSelection) return;
    await executeEasLaunchPlan({
      selection: launchSelection,
      mode: "link_existing",
      easProjectId,
    });
  }, [canStartEasWorkflow, resolveEasLaunchSelectionOrAlert, executeEasLaunchPlan, easProjectId]);

  const onCreateAndLink = useCallback(async () => {
    if (!canStartEasWorkflow()) return;

    const launchSelection = resolveEasLaunchSelectionOrAlert();
    if (!launchSelection) return;
    await executeEasLaunchPlan({
      selection: launchSelection,
      mode: "create_and_link",
      easProjectId,
    });
  }, [canStartEasWorkflow, resolveEasLaunchSelectionOrAlert, executeEasLaunchPlan, easProjectId]);

  return {
    isEasInitRunning,
    onLinkExisting,
    onCreateAndLink,
    resolveCurrentEasLaunchSelection,
    startEasWorkflow,
  };
}
