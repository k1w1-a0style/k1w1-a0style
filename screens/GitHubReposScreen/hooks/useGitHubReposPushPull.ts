import { useCallback, useState } from "react";
import { Alert } from "react-native";

import { pushFilesToRepoAdvanced } from "../../../infra/github/githubService";
import { markRepoSyncSignature } from "../../../lib/repoSyncOrchestration";
import { executePullApply } from "../utils/pullApplySemantics";
import type { PullApplyStrategy } from "../utils/pullApplySemantics";
import { resolvePushPreparation } from "../utils/pushSelectionSemantics";
import { splitFullName } from "../utils/repos";
import {
  buildPushSelectionFromLocalFiles,
  buildPushSelectionForWantedPaths,
} from "./useGitHubReposScreenHelpers";
import { getErrorMessage } from "./githubReposScreenErrorHelpers";
import type { ProjectFile } from "../../../shared/types/project";

type PullFromRepo = (
  owner: string,
  repo: string,
  onProgress?: (message: string) => void,
  branchOverride?: string | null,
) => Promise<ProjectFile[] | null>;

export type PullPreviewState = {
  remote: ProjectFile[];
  conflicts: string[];
  remoteOnly: string[];
  updates: string[];
};

type Deps = {
  activeRepo: string | null;
  activeBranch: string | null;
  normalizedLocalFiles: ProjectFile[];
  updateProjectFiles: (files: ProjectFile[]) => Promise<void>;
  refreshSyncStatus: () => Promise<void>;
  pullFromRepo: PullFromRepo;
  withCoreFiles: (files: ProjectFile[]) => ProjectFile[];
};

export function useGitHubReposPushPull(deps: Deps) {
  const {
    activeRepo,
    activeBranch,
    normalizedLocalFiles,
    updateProjectFiles,
    refreshSyncStatus,
    pullFromRepo,
    withCoreFiles,
  } = deps;

  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pullProgress, setPullProgress] = useState("");

  const [pushModalVisible, setPushModalVisible] = useState(false);
  const [pushCommitMessage, setPushCommitMessage] = useState("chore: sync");
  const [pushSelectedPaths, setPushSelectedPaths] = useState<Record<string, boolean>>({});

  const [pullModalVisible, setPullModalVisible] = useState(false);
  const [pullPreviewLoading, setPullPreviewLoading] = useState(false);
  const [pullPreview, setPullPreview] = useState<PullPreviewState | null>(null);
  const resetPullProgress = useCallback(() => setPullProgress(""), []);

  const handlePull = useCallback(async () => {
    // Pull now opens a preview modal (conflicts + strategy) to avoid silent overwrites.
    if (!activeRepo) {
      Alert.alert("⚠️", "Kein Repo ausgewählt.");
      return;
    }
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;

    if (pullPreviewLoading) return;
    setPullModalVisible(true);
    setPullPreviewLoading(true);
    setPullProgress("");
    setPullPreview(null);

    try {
      const branch = (activeBranch || "").trim();
      if (!branch) {
        Alert.alert("⚠️ Pull", "Kein Branch ausgewählt.");
        setPullModalVisible(false);
        return;
      }
      const pulled = await pullFromRepo(
        parsed.owner,
        parsed.repo,
        (p: string) => setPullProgress(p),
        branch,
      );
      if (!pulled) {
        Alert.alert("⚠️ Pull", "Keine Dateien geladen.");
        setPullModalVisible(false);
        return;
      }

      // Build preview vs local
      const localMap = new Map<string, string>();
      for (const lf of normalizedLocalFiles) localMap.set(lf.path, lf.content);

      const conflicts: string[] = [];
      const updates: string[] = [];
      const remoteOnly: string[] = [];

      for (const rf of pulled) {
        const p = String(rf.path || "");
        if (!p) continue;
        const rContent = String(rf.content ?? "");
        if (!localMap.has(p)) {
          remoteOnly.push(p);
        } else {
          const lContent = localMap.get(p) ?? "";
          if (lContent !== rContent) conflicts.push(p);
          else updates.push(p);
        }
      }

      setPullPreview({ remote: pulled, conflicts, remoteOnly, updates });
    } catch (e: unknown) {
      Alert.alert("❌ Pull fehlgeschlagen", getErrorMessage(e, ""));
      setPullModalVisible(false);
    } finally {
      setPullPreviewLoading(false);
    }
  }, [activeRepo, activeBranch, pullFromRepo, normalizedLocalFiles, pullPreviewLoading]);

  const handlePush = useCallback(async () => {
    // Push now opens options (commit message + file selection).
    if (!activeRepo || !normalizedLocalFiles.length) {
      Alert.alert("⚠️", "Kein Repo/Projekt ausgewählt oder keine Dateien.");
      return;
    }
    setPushSelectedPaths(
      buildPushSelectionFromLocalFiles({
        localFiles: normalizedLocalFiles,
      }),
    );
    setPushModalVisible(true);
  }, [activeRepo, normalizedLocalFiles]);

  const openPushModalForPaths = useCallback(
    (paths: string[]) => {
      if (!activeRepo || !normalizedLocalFiles.length) {
        Alert.alert("⚠️", "Kein Repo/Projekt ausgewählt oder keine Dateien.");
        return;
      }
      const { selection, pickedCount } = buildPushSelectionForWantedPaths({
        localFiles: normalizedLocalFiles,
        wantedPaths: paths,
      });

      if (Array.isArray(paths) && paths.length > 0 && !pickedCount) {
        Alert.alert("⚠️", "Auswahl enthält keine lokalen Dateien (remote-only kann nicht gepusht werden).");
        return;
      }

      setPushSelectedPaths(selection);
      setPushModalVisible(true);
    },
    [activeRepo, normalizedLocalFiles],
  );

  const togglePushPath = useCallback((path: string) => {
    setPushSelectedPaths((prev) => ({ ...prev, [path]: !prev[path] }));
  }, []);

  const setAllPushPaths = useCallback((on: boolean) => {
    setPushSelectedPaths((prev) => {
      const next: Record<string, boolean> = {};
      for (const k of Object.keys(prev)) next[k] = on;
      return next;
    });
  }, []);

  const closePushModal = useCallback(() => setPushModalVisible(false), []);

  const confirmPushSelected = useCallback(async () => {
    if (!activeRepo) return;
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;

    const preparation = resolvePushPreparation({
      activeBranch,
      pushSelectedPaths,
      localFiles: normalizedLocalFiles,
    });

    if (!preparation.ok) {
      Alert.alert(preparation.title, preparation.message);
      return;
    }

    const { branch, selectedFiles } = preparation;

    setIsPushing(true);
    try {
      const pushedFiles = withCoreFiles(selectedFiles);
      await pushFilesToRepoAdvanced(
        parsed.owner,
        parsed.repo,
        pushedFiles,
        { branch, message: pushCommitMessage || "chore: sync" },
      );
      await markRepoSyncSignature({
        linkedRepo: activeRepo,
        linkedBranch: branch,
        files: pushedFiles,
      });
      setPushModalVisible(false);
      await refreshSyncStatus();
      Alert.alert(
        "✅ Push erfolgreich",
        `${parsed.owner}/${parsed.repo}@${branch}\nDer Push wurde als ein konsolidierter Git-Commit übertragen.`,
      );
    } catch (e: unknown) {
      Alert.alert("❌ Push fehlgeschlagen", getErrorMessage(e, ""));
    } finally {
      setIsPushing(false);
    }
  }, [activeRepo, activeBranch, normalizedLocalFiles, pushSelectedPaths, pushCommitMessage, withCoreFiles, refreshSyncStatus]);

  const closePullModal = useCallback(() => {
    if (pullPreviewLoading || isPulling) return;
    setPullModalVisible(false);
    setPullPreview(null);
    setPullProgress("");
  }, [pullPreviewLoading, isPulling]);

  const applyPulledFiles = useCallback(async (strategy: PullApplyStrategy) => {
    if (!pullPreview?.remote) return;

    setIsPulling(true);
    try {
      const semantics = await executePullApply({
        localFiles: normalizedLocalFiles,
        remoteFiles: pullPreview.remote,
        strategy,
        updateProjectFiles,
        markSyncSignature: async (files) => {
          await markRepoSyncSignature({
            linkedRepo: activeRepo,
            linkedBranch: activeBranch,
            files,
          });
        },
        refreshSyncStatus,
        confirmMirrorDelete: async (semantics) => {
          if (strategy !== "mirror" || semantics.summary.localOnlyCount <= 0) return true;
          return await new Promise<boolean>((resolve) => {
            Alert.alert(
              "⚠️ Full Sync / Mirror löscht lokale-only Dateien",
              `Mirror würde ${semantics.summary.localOnlyCount} lokale-only Datei(en) löschen. Fortfahren?`,
              [
                { text: "Abbrechen", style: "cancel", onPress: () => resolve(false) },
                { text: "Ja, löschen und spiegeln", style: "destructive", onPress: () => resolve(true) },
              ],
              { cancelable: false },
            );
          });
        },
      });

      setPullModalVisible(false);
      setPullPreview(null);
      setPullProgress("");
      Alert.alert(semantics.messageTitle, semantics.messageBody);
    } catch (e: unknown) {
      if (getErrorMessage(e, "").includes("Mirror apply canceled by user.")) {
        Alert.alert("ℹ️ Mirror abgebrochen", "Full Sync wurde ohne Änderungen beendet.");
        return;
      }
      Alert.alert("❌ Pull Anwenden fehlgeschlagen", getErrorMessage(e, ""));
    } finally {
      setIsPulling(false);
    }
  }, [pullPreview, normalizedLocalFiles, updateProjectFiles, refreshSyncStatus, activeRepo, activeBranch]);

  return {
    // pull/push busy + progress
    isPulling,
    isPushing,
    pullProgress,
    resetPullProgress,

    // push modal + selection
    pushModalVisible,
    setPushModalVisible,
    pushCommitMessage,
    setPushCommitMessage,
    pushSelectedPaths,
    togglePushPath,
    setAllPushPaths,
    closePushModal,
    handlePush,
    openPushModalForPaths,
    confirmPushSelected,

    // pull modal + preview
    pullModalVisible,
    pullPreviewLoading,
    pullPreview,
    closePullModal,
    handlePull,
    applyPulledFiles,
  };
}
