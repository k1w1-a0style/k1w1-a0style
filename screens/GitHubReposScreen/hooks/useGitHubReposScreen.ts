// screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts
// REFACTORED: template data → templateFiles.ts

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../../../lib/storageKeys";
import { useGitHub } from "../../../contexts/GitHubContext";
import { useProject } from "../../../contexts/ProjectContext";
import {
  pushFilesToRepoAdvanced,
  getGitHubToken,
} from "../../../infra/github/githubService";
import { getGitHubUser } from "../../../infra/github/user";
import { autoSyncRepoSecrets } from "../../../lib/autoSyncRepoSecrets";
import { useGitHubRepos, WorkflowRun } from "../../../hooks/useGitHubRepos";
import { combineRepos, splitFullName } from "../utils/repos";
import { normalizeProjectFiles } from "../utils/projectFiles";
import { markRepoSyncSignature } from "../../../lib/repoSyncOrchestration";
import { executePullApply } from "../utils/pullApplySemantics";
import { resolvePushPreparation } from "../utils/pushSelectionSemantics";
import { runTemplateHardChecklist, resolveEffectiveTemplateId } from "../../../lib/diagnostics/templates";
import type { TemplateId, CoreTemplateId, ProjectFile } from "../../../shared/types/project";

import { getCoreFileContent, CORE_TEMPLATE_FILES } from "./templateFiles";
import type { RepoFilterType } from "./templateFiles";
import { getErrorMessage } from "./githubReposScreenErrorHelpers";
import { getSecretsSyncNotice } from "./githubReposScreenNoticeHelpers";
import { useGitHubRepoCrud } from "./useGitHubRepoCrud";
import {
  buildPushSelectionFromLocalFiles,
  buildPushSelectionForWantedPaths,
} from "./useGitHubReposScreenHelpers";
import { useGitHubReposSelection } from "./useGitHubReposSelection";
import { useGitHubReposEasLink } from "./useGitHubReposEasLink";
import { useGitHubReposSyncStatus } from "./useGitHubReposSyncStatus";

type PullPreviewState = {
  remote: ProjectFile[];
  conflicts: string[];
  remoteOnly: string[];
  updates: string[];
};

export function useGitHubReposScreen() {
  const {
    activeRepo,
    activeBranch,
    recentRepos,
    addRecentRepo,
    clearRecentRepos,
  } = useGitHub();

  const { projectData, updateProjectFiles, setLinkedRepo } = useProject();

  // Local project files are the source of truth for what exists "locally" inside the app.
  // Expose them so the RepoScreen can show local↔remote diffs and wire push/pull UX.
  const normalizedLocalFiles = useMemo<ProjectFile[]>(
    () => normalizeProjectFiles(projectData?.files),
    [projectData?.files],
  );

  const projectFiles = normalizedLocalFiles;

  const templateId: TemplateId = ((projectData?.templateId as TemplateId) || "auto");
  const effectiveTemplateId: CoreTemplateId =
    resolveEffectiveTemplateId(templateId, normalizedLocalFiles).effective;

  const [token, setToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [userLogin, setUserLogin] = useState<string>("" );
  const [userLoading, setUserLoading] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const hasAutoLoaded = useRef(false);

  const isMountedRef = useRef(true);
  const refreshGen = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [showRepoList, setShowRepoList] = useState(true);
  const [showNewRepo, setShowNewRepo] = useState(false);
  const [showRenameRepo, setShowRenameRepo] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<RepoFilterType>("all");

  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [renameName, setRenameName] = useState("");
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pullProgress, setPullProgress] = useState("");

  // Advanced sync UI state
  const [pushModalVisible, setPushModalVisible] = useState(false);
  const [pushCommitMessage, setPushCommitMessage] = useState("chore: sync");
  const [pushSelectedPaths, setPushSelectedPaths] = useState<Record<string, boolean>>({});

  const [pullModalVisible, setPullModalVisible] = useState(false);
  const [pullPreviewLoading, setPullPreviewLoading] = useState(false);
  const [pullPreview, setPullPreview] = useState<PullPreviewState | null>(null);

  const [isSyncingSecrets, setIsSyncingSecrets] = useState(false);

  const [easProjectId, setEasProjectId] = useState<string>("");

  const {
    repos,
    loading: loadingRepos,
    error: reposError,
    loadRepos,
    pullFromRepo,
    loadBranches,
    loadWorkflowRuns,
    loadDefaultBranch,
  } = useGitHubRepos(token);

  const { syncStatus, refreshSyncStatus } = useGitHubReposSyncStatus({
    activeRepo,
    activeBranch,
    normalizedLocalFiles,
    isMountedRef,
  });

  // Token load
  useEffect(() => {
    let mounted = true;
    (async () => {
      setTokenLoading(true);
      setTokenError(null);
      try {
        const t = await getGitHubToken();
        if (!mounted) return;
        setToken(t);
        if (!t) {
          setTokenError("Kein Token gefunden. Hinterlege eins im Verbindungen-Screen.");
        }
      } catch (e: unknown) {
        if (!mounted) return;
        setToken(null);
        setTokenError(getErrorMessage(e, "Token konnte nicht geladen werden."));
      } finally {
        if (mounted) setTokenLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // User info (best-effort)
  useEffect(() => {
    let mounted = true;
    if (!token) {
      setUserLogin("");
      return () => { mounted = false; };
    }
    setUserLoading(true);
    getGitHubUser()
      .then((u) => {
        if (!mounted) return;
        setUserLogin(String(u?.login || "").trim());
      })
      .catch(() => {
        if (!mounted) return;
        setUserLogin("");
      })
      .finally(() => {
        if (mounted) setUserLoading(false);
      });
    return () => { mounted = false; };
  }, [token]);

  // Load EAS project ID
  useEffect(() => {
    let mounted = true;
    (async () => {
      const id = await AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID).catch(() => "");
      if (!mounted) return;
      setEasProjectId((id || "").trim());
    })();
    return () => { mounted = false; };
  }, []);

  // Auto-load repos once token exists
  useEffect(() => {
    if (!token || hasAutoLoaded.current) return;
    hasAutoLoaded.current = true;
    loadRepos();
  }, [token, loadRepos]);

  const handleRefresh = useCallback(async () => {
    if (!token) return;

    const gen = ++refreshGen.current;
    if (isMountedRef.current) setRefreshing(true);

    try {
      await loadRepos();
    } finally {
      if (!isMountedRef.current) return;
      if (gen !== refreshGen.current) return; // newer refresh took over
      setRefreshing(false);
    }
  }, [token, loadRepos]);

  const { handleSelectRepo, handleSelectBranch } = useGitHubReposSelection({
    activeRepo,
    addRecentRepo,
    setLinkedRepo,
    loadDefaultBranch,
    isMountedRef,
    setShowRenameRepo,
    setShowNewRepo,
    setPullProgress,
  });

  const {
    localRepos,
    isCreating,
    isRenaming,
    isDeletingRepo,
    handleCreateRepo,
    handleRenameRepo,
    handleDeleteRepo,
    handleCreateBranch,
    handleRenameBranch,
    handleDeleteBranch,
    manageModal,
    manageValue,
    manageBusy,
    setManageValue,
    closeManageModal,
    confirmManageModal,
  } = useGitHubRepoCrud({
    token,
    activeRepo,
    activeBranch,
    renameName,
    newRepoName,
    newRepoPrivate,
    addRecentRepo,
    setLinkedRepo,
    loadRepos,
    loadDefaultBranch,
    setShowRenameRepo,
    setShowNewRepo,
    setRenameName,
    setNewRepoName,
  });

  const withCoreFiles = useCallback((files: ProjectFile[]): ProjectFile[] => {
    // Ensure core workflow files exist and are valid. Only applies for core templates.
    const mapped = (files ?? []).map((f) => ({
      path: String(f.path),
      content: typeof f.content === "string" ? f.content : JSON.stringify(f.content ?? "", null, 2),
    }));

    const checked = runTemplateHardChecklist(
      mapped.map((f) => ({ path: f.path, content: f.content })),
      { autofix: true },
    );

    const fileMap = new Map<string, string>();
    checked.files.forEach((f) => fileMap.set(f.path, f.content));

    // Ensure required core files exist (if missing)
    for (const corePath of CORE_TEMPLATE_FILES) {
      if (!fileMap.has(corePath)) {
        const content = getCoreFileContent(corePath, effectiveTemplateId);
        if (content != null) fileMap.set(corePath, content);
      }
    }

    return Array.from(fileMap.entries()).map(([path, content]) => ({ path, content }));
  }, [effectiveTemplateId]);

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

  /**
   * Opens the Push options modal but preselects only specific local paths.
   * Used by the Diff UI to push only changed files.
   */
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

  const applyPulledFiles = useCallback(async (strategy: "overwrite" | "skipConflicts") => {
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
      });

      setPullModalVisible(false);
      setPullPreview(null);
      setPullProgress("");
      Alert.alert(semantics.messageTitle, semantics.messageBody);
    } catch (e: unknown) {
      Alert.alert("❌ Pull Anwenden fehlgeschlagen", getErrorMessage(e, ""));
    } finally {
      setIsPulling(false);
    }
  }, [pullPreview, normalizedLocalFiles, updateProjectFiles, refreshSyncStatus, activeRepo, activeBranch]);

  const handleOpenRepoOnGitHub = useCallback(async () => {
    if (!activeRepo) return;
    await Linking.openURL(`https://github.com/${activeRepo}`);
  }, [activeRepo]);

  const {
    isEasLinking,
    easLinkStatus,
    handleEasLinkStatusCheck,
    handleEasLink,
  } = useGitHubReposEasLink({
    activeRepo,
    activeBranch,
    easProjectId,
    isMountedRef,
  });

  const handleSyncSecrets = useCallback(async () => {
    if (!activeRepo) {
      Alert.alert("⚠️", "Kein Repo ausgewählt.");
      return;
    }
    setIsSyncingSecrets(true);
    try {
      const result = await autoSyncRepoSecrets(activeRepo);
      const syncNotice = getSecretsSyncNotice(result.updated);
      Alert.alert(syncNotice.title, syncNotice.message);
    } catch (e: unknown) {
      Alert.alert("❌ Secrets Sync fehlgeschlagen", getErrorMessage(e, ""));
    } finally {
      setIsSyncingSecrets(false);
    }
  }, [activeRepo]);

  const combinedRepos = useMemo(() => combineRepos(repos, localRepos), [repos, localRepos]);

  const activeRepoObj = useMemo(() => {
    if (!activeRepo) return null;
    return combinedRepos.find((r) => r.full_name === activeRepo) ?? null;
  }, [activeRepo, combinedRepos]);

  const filteredRepos = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let list = combinedRepos;

    if (filterType === "activeOnly" && activeRepo) {
      list = list.filter((r) => r.full_name === activeRepo);
    }
    if (filterType === "recentOnly") {
      list = list.filter((r) => recentRepos.includes(r.full_name));
    }

    if (term) {
      list = list.filter((r) => r.full_name.toLowerCase().includes(term));
    }
    return list;
  }, [combinedRepos, searchTerm, filterType, activeRepo, recentRepos]);

  const workflowRuns = useCallback(async (owner: string, repo: string, perPage?: number): Promise<WorkflowRun[]> => {
    return loadWorkflowRuns(owner, repo, perPage);
  }, [loadWorkflowRuns]);

  return {
    // local project
    projectFiles,

    // token
    token, tokenLoading, tokenError,
    userLogin, userLoading,

    // repos
    loadingRepos, reposError, loadRepos, refreshing, handleRefresh,
    combinedRepos, filteredRepos,

    // selection + recent
    activeRepo,
    activeRepoObj,
    activeBranch,
    recentRepos, addRecentRepo, clearRecentRepos,

    // UI states
    showRepoList, setShowRepoList,
    showNewRepo, setShowNewRepo,
    showRenameRepo, setShowRenameRepo,
    showAdvanced, setShowAdvanced,

    // filters + form states
    searchTerm, setSearchTerm,
    filterType, setFilterType,
    newRepoName, setNewRepoName,
    newRepoPrivate, setNewRepoPrivate,
    renameName, setRenameName,

    // ops
    handleSelectRepo, handleSelectBranch,
    handleCreateRepo, isCreating,
    handleRenameRepo, isRenaming,
    handleDeleteRepo, isDeletingRepo,
    handlePull, isPulling, pullProgress,
    handlePush, isPushing,
    openPushModalForPaths,
    // advanced sync UI
    pushModalVisible,
    setPushModalVisible,
    pushCommitMessage,
    setPushCommitMessage,
    pushSelectedPaths,
    togglePushPath,
    setAllPushPaths,
    closePushModal,
    confirmPushSelected,

    pullModalVisible,
    pullPreviewLoading,
    pullPreview,
    closePullModal,
    applyPulledFiles,

    syncStatus,
    refreshSyncStatus,
    handleOpenRepoOnGitHub,
    handleSyncSecrets, isSyncingSecrets,

    // eas link
    easProjectId, setEasProjectId,
    isEasLinking,
    easLinkStatus,
    handleEasLinkStatusCheck,
    handleEasLink,

    // github api helpers
    loadBranches,
    loadDefaultBranch,
    loadWorkflowRuns: workflowRuns,

    // branch ops
    handleCreateBranch,
    handleRenameBranch,
    handleDeleteBranch,

    // manage modal
    manageModal,
    manageValue,
    manageBusy,
    setManageValue,
    closeManageModal,
    confirmManageModal,
  };
}
