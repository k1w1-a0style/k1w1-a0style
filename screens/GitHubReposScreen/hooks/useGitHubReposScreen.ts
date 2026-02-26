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
  pushFilesToRepo,
  deleteRepo as deleteGitHubRepo,
  renameRepo as renameGitHubRepo,
  createBranch,
  deleteBranch,
  renameBranch,
  createOrUpdateFile,
  getRepoFileText,
  getGitHubToken,
} from "../../../infra/github/githubService";
import { getGitHubUser } from "../../../infra/github/user";
import { autoSyncRepoSecrets } from "../../../lib/autoSyncRepoSecrets";
import { useGitHubRepos, GitHubRepo, WorkflowRun } from "../../../hooks/useGitHubRepos";
import { combineRepos, splitFullName, isValidRepoName } from "../utils/repos";
import { runTemplateHardChecklist, resolveEffectiveTemplateId } from "../../../lib/diagnostics/templates";
import type { TemplateId, CoreTemplateId } from "../../../shared/types/project";


import {
  loadCoreTemplateFiles,
  getCoreFileContent,
  CORE_TEMPLATE_FILES,
} from "./templateFiles";
import type { TemplateFile, RepoFilterType } from "./templateFiles";

export function useGitHubReposScreen() {
  const {
    activeRepo,
    setActiveRepo,
    activeBranch,
    setActiveBranch,
    recentRepos,
    addRecentRepo,
    clearRecentRepos,
  } = useGitHub();

  const { projectData, updateProjectFiles, setLinkedRepo } = useProject();

  const templateId: TemplateId = ((projectData?.templateId as TemplateId) || "auto");
  const effectiveTemplateId: CoreTemplateId =
    resolveEffectiveTemplateId(templateId, (projectData?.files || []) as any).effective;

  const [token, setToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [userLogin, setUserLogin] = useState<string>("" );
  const [userLoading, setUserLoading] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const hasAutoLoaded = useRef(false);
  const hasRestoredLink = useRef(false);

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

  const [isSyncingSecrets, setIsSyncingSecrets] = useState(false);

  const [easProjectId, setEasProjectId] = useState<string>("");
  const [isEasLinking, setIsEasLinking] = useState(false);
  const [easLinkStatus, setEasLinkStatus] = useState<"unknown" | "ok" | "missing">("unknown");

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

  const openManageModal = useCallback((cfg: ManageModalConfig) => {
    setManageModal(cfg);
    setManageValue(cfg.initialValue ?? "");
  }, []);

  const closeManageModal = useCallback(() => setManageModal(null), []);

  const {
    repos,
    loading: loadingRepos,
    loadRepos,
    pullFromRepo,
    loadBranches,
    loadWorkflowRuns,
    loadDefaultBranch,
  } = useGitHubRepos(token);

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
      } catch (e: any) {
        if (!mounted) return;
        setToken(null);
        setTokenError(e?.message ?? "Token konnte nicht geladen werden.");
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

  // Auto-restore linked repo/branch from project context once
  useEffect(() => {
    if (!hasRestoredLink.current && projectData?.linkedRepo && !activeRepo) {
      hasRestoredLink.current = true;
      setActiveRepo(projectData.linkedRepo);
      if (projectData.linkedBranch) setActiveBranch(projectData.linkedBranch);
    }
  }, [projectData, activeRepo, setActiveRepo, setActiveBranch]);

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

  const handleSelectRepo = useCallback((repoOrString: GitHubRepo | string) => {
  const fullName =
    typeof repoOrString === "string" ? repoOrString : repoOrString.full_name;

  // Prefer default branch from the repo list payload (fast), fallback to API if needed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defaultBranch: string | null =
    typeof repoOrString === "string"
      ? null
      : String((repoOrString as any)?.default_branch || "").trim() || null;

  // Single source of truth for ALL repo selections (list + recent)
  setActiveRepo(fullName);
  addRecentRepo(fullName);

  if (defaultBranch) {
    setActiveBranch(defaultBranch);
    setLinkedRepo(fullName, defaultBranch);
  } else {
    setActiveBranch(null);
    setLinkedRepo(fullName, null);
  }

  setShowRepoList(false);
  setShowRenameRepo(false);
  setShowNewRepo(false);
  setPullProgress("");

  // If we don't have a default branch yet (e.g. recent repo string), fetch it async.
  if (!defaultBranch) {
    const parsed = splitFullName(fullName);
    if (!parsed) return;

    const gen = ++selectRepoGen.current;
    loadDefaultBranch(parsed.owner, parsed.repo)
      .then((b) => String(b || "").trim())
      .then((b) => {
        if (!b) return;
        if (!isMountedRef.current) return;
        if (gen !== selectRepoGen.current) return;
        setActiveBranch(activeBranch || b);
        setLinkedRepo(fullName, b);
      })
      .catch(() => {
        // non-fatal: user can still pick a branch manually
      });
  }
}, [setActiveRepo, addRecentRepo, setLinkedRepo, setActiveBranch, loadDefaultBranch, activeBranch]);

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
      setActiveBranch(branch);
      if (activeRepo) {
        setLinkedRepo(activeRepo, branch);
        rememberRecentBranch(activeRepo, branch);
      }
    },
    [setActiveBranch, activeRepo, setLinkedRepo, rememberRecentBranch],
  );

  const withCoreFiles = useCallback((files: any[]): any[] => {
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
      setLocalRepos((prev) => [repo as any, ...prev]);
      setNewRepoName("");
      setShowNewRepo(false);
      setActiveRepo(repo.full_name);
      addRecentRepo(repo.full_name);
      setLinkedRepo(repo.full_name, null);
      setActiveBranch(null);
      Alert.alert("✅ Repo erstellt", repo.full_name);
    } catch (e: any) {
      Alert.alert("❌ Repo erstellen fehlgeschlagen", e?.message ?? "");
    } finally {
      setIsCreating(false);
    }
  }, [token, newRepoName, newRepoPrivate, setActiveRepo, addRecentRepo, setLinkedRepo, setActiveBranch]);

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
      setActiveRepo(newFullName);
      setLinkedRepo(newFullName, activeBranch ?? null);
      addRecentRepo(newFullName);
      setShowRenameRepo(false);
      setRenameName("");
      Alert.alert("✅ Repo umbenannt", newFullName);
      await loadRepos();
    } catch (e: any) {
      Alert.alert("❌ Umbenennen fehlgeschlagen", e?.message ?? "");
    } finally {
      setIsRenaming(false);
    }
  }, [token, activeRepo, renameName, setActiveRepo, setLinkedRepo, activeBranch, addRecentRepo, loadRepos]);

  const handleDeleteRepo = useCallback(async (repo: GitHubRepo) => {
    if (!token) return;
    const full = repo.full_name;
    const parsed = splitFullName(full);
    if (!parsed) return;

    Alert.alert(
      "🗑️ Repo löschen?",
      `Willst du ${full} wirklich löschen? Das kann nicht rückgängig gemacht werden.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            setIsDeletingRepo(true);
            try {
              await deleteGitHubRepo(parsed.owner, parsed.repo);
              setLocalRepos((prev) => prev.filter((r) => r.full_name !== full));
              if (activeRepo === full) {
                setActiveRepo(null);
                setActiveBranch(null);
                setLinkedRepo(null, null);
              }
              await loadRepos();
              Alert.alert("✅ Repo gelöscht", full);
            } catch (e: any) {
              Alert.alert("❌ Löschen fehlgeschlagen", e?.message ?? "");
            } finally {
              setIsDeletingRepo(false);
            }
          },
        },
      ],
    );
  }, [token, activeRepo, setActiveRepo, setActiveBranch, setLinkedRepo, loadRepos]);

  const handlePull = useCallback(async () => {
    if (!activeRepo) {
      Alert.alert("⚠️", "Kein Repo ausgewählt.");
      return;
    }
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;

    setIsPulling(true);
    setPullProgress("");
    try {
      const pulled = await pullFromRepo(
        parsed.owner,
        parsed.repo,
        (p: string) => setPullProgress(p),
      );
      if (!pulled) {
        Alert.alert("⚠️ Pull", "Keine Dateien geladen.");
        return;
      }
      updateProjectFiles(pulled as any);
      Alert.alert("✅ Pull erfolgreich", `${pulled.length} Dateien aktualisiert.`);
    } catch (e: any) {
      Alert.alert("❌ Pull fehlgeschlagen", e?.message ?? "");
    } finally {
      setIsPulling(false);
    }
  }, [activeRepo, pullFromRepo, updateProjectFiles]);

  const handlePush = useCallback(async () => {
    if (!activeRepo || !projectData?.files?.length) {
      Alert.alert("⚠️", "Kein Repo/Projekt ausgewählt oder keine Dateien.");
      return;
    }
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;

    setIsPushing(true);
    try {
      const branch = activeBranch ?? "main";
      await pushFilesToRepo(
        parsed.owner,
        parsed.repo,
        withCoreFiles(projectData.files as any),
        branch
      );
      Alert.alert("✅ Push erfolgreich", `${parsed.owner}/${parsed.repo}@${branch}`);
    } catch (e: any) {
      Alert.alert("❌ Push fehlgeschlagen", e?.message ?? "");
    } finally {
      setIsPushing(false);
    }
  }, [activeRepo, activeBranch, projectData, withCoreFiles, token]);

  const handleOpenRepoOnGitHub = useCallback(async () => {
    if (!activeRepo) return;
    await Linking.openURL(`https://github.com/${activeRepo}`);
  }, [activeRepo]);

  const handleEasLinkStatusCheck = useCallback(async () => {
    if (!activeRepo || !activeBranch) return;
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;
    try {
      await getRepoFileText({
        owner: parsed.owner,
        repo: parsed.repo,
        path: ".github/workflows/eas-link.yml",
        ref: activeBranch,
      });
      setEasLinkStatus("ok");
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("404") || msg.toLowerCase().includes("not found")) setEasLinkStatus("missing");
      else setEasLinkStatus("unknown");
    }
  }, [activeRepo, activeBranch]);

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

    setIsEasLinking(true);
    try {
      const branch = activeBranch ?? "main";
      const workflowPath = ".github/workflows/eas-link.yml";
      const workflow = getCoreFileContent(workflowPath, effectiveTemplateId) ?? "";
      const patched = workflow.replace(/EAS_PROJECT_ID:.*/g, `EAS_PROJECT_ID: ${id}`);

      await createOrUpdateFile(parsed.owner, parsed.repo, workflowPath, patched, "chore: link EAS project", branch);

      setEasLinkStatus("ok");
      Alert.alert("✅ EAS linked", `EAS Project ID eingebunden in ${workflowPath}`);
    } catch (e: any) {
      Alert.alert("❌ EAS link fehlgeschlagen", e?.message ?? "");
    } finally {
      setIsEasLinking(false);
    }
  }, [activeRepo, activeBranch, easProjectId, effectiveTemplateId]);

  const handleSyncSecrets = useCallback(async () => {
    if (!activeRepo) {
      Alert.alert("⚠️", "Kein Repo ausgewählt.");
      return;
    }
    setIsSyncingSecrets(true);
    try {
      const result = await autoSyncRepoSecrets(activeRepo);
      if (!result.updated.length) {
        Alert.alert("ℹ️ Secrets", "Keine Secrets zum Synchronisieren gefunden.");
      } else {
        Alert.alert("✅ Secrets synchronisiert", result.updated.join(", "));
      }
    } catch (e: any) {
      Alert.alert("❌ Secrets Sync fehlgeschlagen", e?.message ?? "");
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
        setActiveBranch(res.name);
        setLinkedRepo(activeRepo, res.name);
        closeManageModal();
      },
    });
  }, [activeRepo, activeBranch, loadDefaultBranch, openManageModal, closeManageModal, setActiveBranch, setLinkedRepo]);

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
        setActiveBranch(res.name);
        setLinkedRepo(activeRepo, res.name);
        closeManageModal();
      },
    });
  }, [activeRepo, activeBranch, openManageModal, closeManageModal, setActiveBranch, setLinkedRepo]);

  const handleDeleteBranch = useCallback(() => {
    if (!activeRepo || !activeBranch) return;
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;
    Alert.alert("Branch löschen?", `${activeBranch} wirklich löschen?`, [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteBranch(parsed.owner, parsed.repo, activeBranch);
            setActiveBranch(null);
            setLinkedRepo(activeRepo, null);
            Alert.alert("✅ Branch gelöscht", activeBranch);
          } catch (e: any) {
            Alert.alert("❌ Fehler", e?.message ?? "");
          }
        },
      },
    ]);
  }, [activeRepo, token, activeBranch, setActiveBranch, setLinkedRepo]);

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
    // token
    token, tokenLoading, tokenError,
    userLogin, userLoading,

    // repos
    loadingRepos, loadRepos, refreshing, handleRefresh,
    combinedRepos, filteredRepos,

    // selection + recent
    activeRepo, setActiveRepo,
    activeRepoObj,
    activeBranch, setActiveBranch,
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
    setManageValue,
    closeManageModal,
  };
}
