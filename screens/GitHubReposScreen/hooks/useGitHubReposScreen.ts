// screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts
// REFACTORED: template data → templateFiles.ts

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../../../lib/storageKeys";
import { useGitHub } from "../../../contexts/GitHubContext";
import { useProject } from "../../../contexts/ProjectContext";
import {
  createRepo,
  pushFilesToRepoAdvanced,
  deleteRepo as deleteGitHubRepo,
  renameRepo as renameGitHubRepo,
  createBranch,
  deleteBranch,
  renameBranch,
  compareLocalFilesWithRepo,
  createOrUpdateFile,
  getRepoFileText,
  getGitHubToken,
} from "../../../infra/github/githubService";
import { getGitHubUser } from "../../../infra/github/user";
import { autoSyncRepoSecrets } from "../../../lib/autoSyncRepoSecrets";
import { useGitHubRepos, GitHubRepo, WorkflowRun } from "../../../hooks/useGitHubRepos";
import { combineRepos, splitFullName, isValidRepoName } from "../utils/repos";
import { normalizeProjectFiles } from "../utils/projectFiles";
import { validateEasProjectId } from "../../ConnectionsScreen/utils/validation";
import { markRepoSyncSignature } from "../../../lib/repoSyncOrchestration";
import { executePullApply } from "../utils/pullApplySemantics";
import { resolvePushPreparation } from "../utils/pushSelectionSemantics";
import {
  checkRepoEasLinkStatus,
  getEasLinkPresentation,
  resolveEasLinkWriteOutcome,
  type EasLinkPresentation,
} from "../utils/easLinkContract";
import {
  createEasLinkStatusRequestGuard,
  type EasLinkStatusRequestToken,
} from "../utils/easLinkStatusRequestGuard";
import { runTemplateHardChecklist, resolveEffectiveTemplateId } from "../../../lib/diagnostics/templates";
import type { TemplateId, CoreTemplateId, ProjectFile } from "../../../shared/types/project";

import {
  loadCoreTemplateFiles,
  getCoreFileContent,
  CORE_TEMPLATE_FILES,
} from "./templateFiles";
import type { TemplateFile, RepoFilterType } from "./templateFiles";
import { getErrorMessage } from "./githubReposScreenErrorHelpers";
import { getEasLinkWriteNotice, getRepoSuccessNotice, getSecretsSyncNotice } from "./githubReposScreenNoticeHelpers";
import { getDeleteBranchConfirmDialog, getDeleteRepoConfirmDialog } from "./githubReposScreenDialogHelpers";
import {
  buildRepoBranchContextKey,
  getEasLinkNeutralMessage,
} from "./useGitHubReposScreenHelpers";

type SyncStatus = {
  checking: boolean;
  modified: number;
  localOnly: number;
  remoteOnly: number;
  skipped: number;
  error: number;
  checkedAt: number | null;
};

type PullPreviewState = {
  remote: ProjectFile[];
  conflicts: string[];
  remoteOnly: string[];
  updates: string[];
};

const EMPTY_SYNC_STATUS: SyncStatus = {
  checking: false,
  modified: 0,
  localOnly: 0,
  remoteOnly: 0,
  skipped: 0,
  error: 0,
  checkedAt: null,
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
  const selectRepoGen = useRef(0);

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

  const [localRepos, setLocalRepos] = useState<GitHubRepo[]>([]);
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [renameName, setRenameName] = useState("");

  const [isCreating, setIsCreating] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeletingRepo, setIsDeletingRepo] = useState(false);
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

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(EMPTY_SYNC_STATUS);

  const [isSyncingSecrets, setIsSyncingSecrets] = useState(false);

  const [easProjectId, setEasProjectId] = useState<string>("");
  const [isEasLinking, setIsEasLinking] = useState(false);
  const [easLinkStatus, setEasLinkStatus] = useState<EasLinkPresentation>(getEasLinkPresentation("unknown"));
  const easLinkContextKey = useMemo(
    () => buildRepoBranchContextKey(activeRepo, activeBranch),
    [activeRepo, activeBranch],
  );
  const easLinkStatusGuardRef = useRef(createEasLinkStatusRequestGuard(easLinkContextKey));

  // Manage Modal (used for branch operations)
  type ManageModalConfig = {
    title: string;
    placeholder: string;
    initialValue?: string;
    confirmText?: string;
    action: (value: string) => Promise<void>;
  };
  const [manageModal, setManageModal] = useState<ManageModalConfig | null>(null);
  const [manageValue, setManageValue] = useState("");
  const [manageBusy, setManageBusy] = useState(false);

  const openManageModal = useCallback((cfg: ManageModalConfig) => {
    setManageModal(cfg);
    setManageValue(cfg.initialValue ?? "");
  }, []);

  const closeManageModal = useCallback(() => setManageModal(null), []);

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

  const syncStatusRunRef = useRef(0);

  useEffect(() => {
    easLinkStatusGuardRef.current.setContextKey(easLinkContextKey);
    setEasLinkStatus(
      getEasLinkPresentation(
        "unknown",
        getEasLinkNeutralMessage(easLinkContextKey),
      ),
    );
  }, [easLinkContextKey]);

  const refreshSyncStatus = useCallback(async () => {
    const runId = ++syncStatusRunRef.current;
    const commitSyncStatus = (next: SyncStatus) => {
      if (!isMountedRef.current) return;
      if (runId !== syncStatusRunRef.current) return;
      setSyncStatus(next);
    };
    if (!activeRepo) {
      commitSyncStatus({ ...EMPTY_SYNC_STATUS, checkedAt: Date.now() });
      return;
    }
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;

    const branch = (activeBranch || "").trim();
    if (!branch) {
      commitSyncStatus({ ...EMPTY_SYNC_STATUS, checkedAt: Date.now(), error: 1 });
      return;
    }
    commitSyncStatus({ ...EMPTY_SYNC_STATUS, checking: true });

    try {
      const stats = await compareLocalFilesWithRepo({
        owner: parsed.owner,
        repo: parsed.repo,
        branch,
        localFiles: normalizedLocalFiles,
        maxLocalFiles: 40,
      });
      commitSyncStatus({ checking: false, ...stats, checkedAt: Date.now() });
    } catch {
      commitSyncStatus({ ...EMPTY_SYNC_STATUS, checking: false, error: 1, checkedAt: Date.now() });
    }
  }, [activeRepo, activeBranch, normalizedLocalFiles]);

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

  // Keep a lightweight "dirty" indicator up to date when repo/branch changes.
  useEffect(() => {
    if (!activeRepo) {
      setSyncStatus(EMPTY_SYNC_STATUS);
      return;
    }
    // fire-and-forget (best-effort)
    refreshSyncStatus();
  }, [activeRepo, activeBranch]);

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

  const handleSelectRepo = useCallback((repoOrString: GitHubRepo | string) => {
  const fullName =
    typeof repoOrString === "string" ? repoOrString : repoOrString.full_name;
  const selectionGen = ++selectRepoGen.current;

  // Prefer default branch from the repo list payload (fast), fallback to API if needed.
  const defaultBranch: string | null =
    typeof repoOrString === "string"
      ? null
      : String(repoOrString.default_branch || "").trim() || null;

  // Single source of truth for ALL repo selections (list + recent)
  addRecentRepo(fullName);
  setLinkedRepo(fullName, defaultBranch);
  setShowRenameRepo(false);
  setShowNewRepo(false);
  setPullProgress("");

  // If we don't have a default branch yet (e.g. recent repo string), fetch it async.
  if (!defaultBranch) {
    const parsed = splitFullName(fullName);
    if (!parsed) return;

    loadDefaultBranch(parsed.owner, parsed.repo)
      .then((b) => String(b || "").trim())
      .then((b) => {
        if (!b) return;
        if (!isMountedRef.current) return;
        if (selectionGen !== selectRepoGen.current) return;
        setLinkedRepo(fullName, b);
      })
      .catch(() => {
        // non-fatal: user can still pick a branch manually
      });
  }
}, [addRecentRepo, setLinkedRepo, loadDefaultBranch]);

  const confirmManageModal = useCallback(async () => {
    if (!manageModal || manageBusy) return;

    setManageBusy(true);
    try {
      await manageModal.action(manageValue);
    } finally {
      setManageBusy(false);
    }
  }, [manageModal, manageBusy, manageValue]);

  const rememberRecentBranch = useCallback(async (repoFullName: string, branch: string) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_BRANCHES_BY_REPO).catch(
        () => null,
      );
      const map = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
      const prev = Array.isArray(map[repoFullName]) ? map[repoFullName] : [];
      const next = [branch, ...prev.filter((b) => b !== branch)].slice(0, 6);
      map[repoFullName] = next;
      await AsyncStorage.setItem(
        STORAGE_KEYS.RECENT_BRANCHES_BY_REPO,
        JSON.stringify(map),
      ).catch(() => null);
    } catch {
      // best-effort
    }
  }, []);

  const handleSelectBranch = useCallback(
    (branch: string) => {
      if (activeRepo) {
        setLinkedRepo(activeRepo, branch);
        rememberRecentBranch(activeRepo, branch);
      }
    },
    [activeRepo, setLinkedRepo, rememberRecentBranch],
  );

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

  const handleCreateRepo = useCallback(async () => {
    if (!token) return;
    const name = newRepoName.trim();
    const validation = isValidRepoName(name);
    if (!validation.valid) {
      Alert.alert("❌ Ungültiger Name", validation.error ?? "");
      return;
    }

    setIsCreating(true);
    try {
      const repo = await createRepo(name, newRepoPrivate);
      setLocalRepos((prev) => [repo, ...prev]);
      setNewRepoName("");
      setShowNewRepo(false);
      addRecentRepo(repo.full_name);
      const defaultBranch = String(repo.default_branch || "").trim() || null;
      setLinkedRepo(repo.full_name, defaultBranch);
      const successNotice = getRepoSuccessNotice("repo_created", repo.full_name);
      Alert.alert(successNotice.title, successNotice.message);
    } catch (e: unknown) {
      Alert.alert("❌ Repo erstellen fehlgeschlagen", getErrorMessage(e, ""));
    } finally {
      setIsCreating(false);
    }
  }, [token, newRepoName, newRepoPrivate, addRecentRepo, setLinkedRepo]);

  const handleRenameRepo = useCallback(async () => {
    if (!token || !activeRepo) return;
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;

    const newName = renameName.trim();
    const validation = isValidRepoName(newName);
    if (!validation.valid) {
      Alert.alert("❌ Ungültiger Name", validation.error ?? "");
      return;
    }

    setIsRenaming(true);
    try {
      const res = await renameGitHubRepo(parsed.owner, parsed.repo, newName);
      const newFullName = res.full_name ?? `${parsed.owner}/${newName}`;
      setLinkedRepo(newFullName, activeBranch ?? null);
      addRecentRepo(newFullName);
      setShowRenameRepo(false);
      setRenameName("");
      const successNotice = getRepoSuccessNotice("repo_renamed", newFullName);
      Alert.alert(successNotice.title, successNotice.message);
      await loadRepos();
    } catch (e: unknown) {
      Alert.alert("❌ Umbenennen fehlgeschlagen", getErrorMessage(e, ""));
    } finally {
      setIsRenaming(false);
    }
  }, [token, activeRepo, renameName, setLinkedRepo, activeBranch, addRecentRepo, loadRepos]);

  const handleDeleteRepo = useCallback(async (repo: GitHubRepo) => {
    if (!token) return;
    const full = repo.full_name;
    const parsed = splitFullName(full);
    if (!parsed) return;

    const dialogText = getDeleteRepoConfirmDialog(full);

    Alert.alert(
      dialogText.title,
      dialogText.message,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: dialogText.confirmText,
          style: "destructive",
          onPress: async () => {
            setIsDeletingRepo(true);
            try {
              await deleteGitHubRepo(parsed.owner, parsed.repo);
              setLocalRepos((prev) => prev.filter((r) => r.full_name !== full));
              if (activeRepo === full) {
                setLinkedRepo(null, null);
              }
              await loadRepos();
              const successNotice = getRepoSuccessNotice("repo_deleted", full);
              Alert.alert(successNotice.title, successNotice.message);
            } catch (e: unknown) {
              Alert.alert("❌ Löschen fehlgeschlagen", getErrorMessage(e, ""));
            } finally {
              setIsDeletingRepo(false);
            }
          },
        },
      ],
    );
  }, [token, activeRepo, setLinkedRepo, loadRepos]);

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
    const initial: Record<string, boolean> = {};
    for (const f of normalizedLocalFiles) {
      const p = f.path;
      if (!p) continue;
      initial[p] = true;
    }
    setPushSelectedPaths(initial);
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
      const wanted = new Set((paths || []).map((p) => String(p || "").trim()).filter(Boolean));
      const initial: Record<string, boolean> = {};

      for (const f of normalizedLocalFiles) {
        const p = f.path;
        if (!p) continue;
        if (!wanted.size) initial[p] = true;
        else if (wanted.has(p)) initial[p] = true;
      }

      if (wanted.size) {
        const picked = Object.values(initial).filter(Boolean).length;
        if (!picked) {
          Alert.alert("⚠️", "Auswahl enthält keine lokalen Dateien (remote-only kann nicht gepusht werden).");
          return;
        }
      }

      setPushSelectedPaths(initial);
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

  const isCurrentEasLinkRequest = useCallback((requestId: number, contextKey: string | null) => {
    if (!isMountedRef.current) return false;
    return easLinkStatusGuardRef.current.isCurrent({ requestId, contextKey });
  }, []);

  const handleEasLinkStatusCheck = useCallback(async (): Promise<EasLinkPresentation | null> => {
    if (!activeRepo || !activeBranch) {
      easLinkStatusGuardRef.current.invalidate();
      const presentation = getEasLinkPresentation("unknown", "Repo oder Branch sind noch nicht ausgewaehlt.");
      setEasLinkStatus(presentation);
      return presentation;
    }

    const parsed = splitFullName(activeRepo);
    if (!parsed) {
      easLinkStatusGuardRef.current.invalidate();
      const presentation = getEasLinkPresentation("unknown", "Repo-Auswahl konnte nicht verarbeitet werden.");
      setEasLinkStatus(presentation);
      return presentation;
    }

    const contextKey = `${activeRepo}@@${activeBranch}`;
    const requestToken = easLinkStatusGuardRef.current.begin(contextKey);
    const presentation = await checkRepoEasLinkStatus({
      expectedProjectId: easProjectId,
      loadFile: (path: string) =>
        getRepoFileText({
          owner: parsed.owner,
          repo: parsed.repo,
          path,
          ref: activeBranch,
        }),
    });

    if (!isCurrentEasLinkRequest(requestToken.requestId, requestToken.contextKey)) {
      return null;
    }

    setEasLinkStatus(presentation);
    return presentation;
  }, [activeRepo, activeBranch, easProjectId, isCurrentEasLinkRequest]);

  const handleEasLink = useCallback(async () => {
    if (!activeRepo) {
      Alert.alert("⚠️", "Kein Repo ausgewählt.");
      return;
    }
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;

    const id = (easProjectId || "").trim();
    if (!id) {
      Alert.alert("⚠️", "Bitte EAS Project ID setzen (AsyncStorage).");
      return;
    }

    const idValidation = validateEasProjectId(id);
    if (!idValidation.ok) {
      Alert.alert(idValidation.title, idValidation.message);
      return;
    }

    const branch = (activeBranch || "").trim();
    if (!branch) {
      Alert.alert("⚠️", "Kein Branch ausgewählt.");
      return;
    }

    const contextKey = buildRepoBranchContextKey(activeRepo, branch);
    if (!contextKey) {
      setEasLinkStatus(getEasLinkPresentation("unknown", "Repo oder Branch sind noch nicht ausgewaehlt."));
      return;
    }
    const writeToken = easLinkStatusGuardRef.current.begin(contextKey);

    setIsEasLinking(true);
    if (isCurrentEasLinkRequest(writeToken.requestId, writeToken.contextKey)) {
      setEasLinkStatus(
        getEasLinkPresentation(
          "pending_recheck",
          "Schreibe `eas-project.json` und pruefe den Repo-Zustand danach erneut.",
        ),
      );
    }
    try {
      const easProjectJsonPath = "eas-project.json";
      const content = JSON.stringify({ projectId: id }, null, 2) + "\n";

      await createOrUpdateFile(
        parsed.owner,
        parsed.repo,
        easProjectJsonPath,
        content,
        "chore(eas): write eas-project.json",
        branch,
      );

      if (!isCurrentEasLinkRequest(writeToken.requestId, writeToken.contextKey)) {
        return;
      }

      const verification = await handleEasLinkStatusCheck();
      if (!verification) {
        return;
      }

      const recheckToken: EasLinkStatusRequestToken = {
        requestId: easLinkStatusGuardRef.current.getCurrentRequestId(),
        contextKey,
      };
      const writeOutcome = resolveEasLinkWriteOutcome({ verification });
      if (isCurrentEasLinkRequest(recheckToken.requestId, recheckToken.contextKey)) {
        setEasLinkStatus(writeOutcome);
      }

      if (!isCurrentEasLinkRequest(recheckToken.requestId, recheckToken.contextKey)) {
        return;
      }

      const writeNotice = getEasLinkWriteNotice(writeOutcome);
      Alert.alert(writeNotice.title, writeNotice.message);
    } catch (e: unknown) {
      if (isCurrentEasLinkRequest(writeToken.requestId, writeToken.contextKey)) {
        setEasLinkStatus(getEasLinkPresentation("unknown", "Schreiben oder Nachverifikation ist fehlgeschlagen."));
        Alert.alert("❌ EAS link fehlgeschlagen", getErrorMessage(e, ""));
      }
    } finally {
      setIsEasLinking(false);
    }
  }, [activeRepo, activeBranch, easProjectId, handleEasLinkStatusCheck, isCurrentEasLinkRequest]);

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

  // Branch ops in Manage modal
  const handleCreateBranch = useCallback(() => {
    if (!activeRepo) return;
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;
    openManageModal({
      title: "Neuen Branch erstellen",
      placeholder: "branch-name",
      confirmText: "Erstellen",
      action: async (value: string) => {
        const name = value.trim();
        if (!name) throw new Error("Branch Name fehlt.");
        const base = activeBranch ?? (await loadDefaultBranch(parsed.owner, parsed.repo));
        await createBranch(parsed.owner, parsed.repo, name, base);
        const res = { name };
        setLinkedRepo(activeRepo, res.name);
        closeManageModal();
      },
    });
  }, [activeRepo, activeBranch, loadDefaultBranch, openManageModal, closeManageModal, setLinkedRepo]);

  const handleRenameBranch = useCallback(() => {
    if (!activeRepo || !activeBranch) return;
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;
    openManageModal({
      title: "Branch umbenennen",
      placeholder: "neuer-branch-name",
      initialValue: activeBranch,
      confirmText: "Umbenennen",
      action: async (newName: string) => {
        const name = newName.trim();
        if (!name) throw new Error("Branch Name fehlt.");
        const res = await renameBranch(parsed.owner, parsed.repo, activeBranch, name);
        setLinkedRepo(activeRepo, res.name);
        closeManageModal();
      },
    });
  }, [activeRepo, activeBranch, openManageModal, closeManageModal, setLinkedRepo]);

  const handleDeleteBranch = useCallback(() => {
    if (!activeRepo || !activeBranch) return;
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;
    const dialogText = getDeleteBranchConfirmDialog(activeBranch);
    Alert.alert(dialogText.title, dialogText.message, [
      { text: "Abbrechen", style: "cancel" },
      {
        text: dialogText.confirmText,
        style: "destructive",
          onPress: async () => {
            try {
              await deleteBranch(parsed.owner, parsed.repo, activeBranch);
              setLinkedRepo(activeRepo, null);
              const successNotice = getRepoSuccessNotice("branch_deleted", activeBranch);
              Alert.alert(successNotice.title, successNotice.message);
          } catch (e: unknown) {
            Alert.alert("❌ Fehler", getErrorMessage(e, ""));
          }
        },
      },
    ]);
  }, [activeRepo, activeBranch, setLinkedRepo]);

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
