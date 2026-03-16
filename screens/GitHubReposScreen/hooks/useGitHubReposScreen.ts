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
  pushFilesToRepoAdvanced,
  deleteRepo as deleteGitHubRepo,
  renameRepo as renameGitHubRepo,
  createBranch,
  deleteBranch,
  renameBranch,
  createOrUpdateFile,
  getRepoFileText,
  listRepoBlobPaths,
  getGitHubToken,
} from "../../../infra/github/githubService";
import { getGitHubUser } from "../../../infra/github/user";
import { autoSyncRepoSecrets } from "../../../lib/autoSyncRepoSecrets";
import { useGitHubRepos, GitHubRepo, WorkflowRun } from "../../../hooks/useGitHubRepos";
import { combineRepos, splitFullName, isValidRepoName } from "../utils/repos";
import { runTemplateHardChecklist, resolveEffectiveTemplateId } from "../../../lib/diagnostics/templates";
import type { TemplateId, CoreTemplateId, ProjectFile } from "../../../shared/types/project";

import { MANAGED_WORKFLOWS, normalizeRepoPath } from "../../../infra/github/utils";


import {
  loadCoreTemplateFiles,
  getCoreFileContent,
  CORE_TEMPLATE_FILES,
} from "./templateFiles";
import type { TemplateFile, RepoFilterType } from "./templateFiles";

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
    setActiveRepo,
    activeBranch,
    setActiveBranch,
    recentRepos,
    addRecentRepo,
    clearRecentRepos,
  } = useGitHub();

  const { projectData, updateProjectFiles, setLinkedRepo } = useProject();

  // Local project files are the source of truth for what exists "locally" inside the app.
  // Expose them so the RepoScreen can show local↔remote diffs and wire push/pull UX.
  const projectFiles = useMemo<ProjectFile[]>(() => {
    const list = projectData?.files;
    return Array.isArray(list) ? list : [];
  }, [projectData?.files]);

  const templateId: TemplateId = ((projectData?.templateId as TemplateId) || "auto");
  const effectiveTemplateId: CoreTemplateId =
    resolveEffectiveTemplateId(templateId, projectFiles).effective;

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

  const normalizedLocalFiles = useMemo<ProjectFile[]>(() => {
    const out: ProjectFile[] = [];
    for (const file of projectFiles) {
      const path = String(file.path || "").trim();
      if (!path) continue;
      out.push({ path, content: String(file.content ?? "") });
    }
    return out;
  }, [projectFiles]);

  const syncStatusRunRef = useRef(0);

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
    const local = normalizedLocalFiles;
    if (!local.length) {
      // remoteOnly still meaningful
      commitSyncStatus({ ...EMPTY_SYNC_STATUS, checking: true });
      try {
        const remotePaths = await listRepoBlobPaths({ owner: parsed.owner, repo: parsed.repo, ref: branch });
        commitSyncStatus({ ...EMPTY_SYNC_STATUS, remoteOnly: remotePaths.length, checkedAt: Date.now() });
      } catch {
        commitSyncStatus({ ...EMPTY_SYNC_STATUS, error: 1, checkedAt: Date.now() });
      }
      return;
    }

    const MAX = 40;
    const slice = local.slice(0, MAX);

    commitSyncStatus({ ...EMPTY_SYNC_STATUS, checking: true });

    let modified = 0;
    let localOnly = 0;
    let skipped = 0;
    let error = 0;

    const localPaths = new Set<string>();
    for (const f of slice) {
      const p = normalizeRepoPath(String(f.path || "").trim());
      if (!p) continue;
      localPaths.add(p);
      if (p.startsWith(".github/workflows/") && !MANAGED_WORKFLOWS.has(p)) {
        skipped++;
        continue;
      }
      try {
        const remote = await getRepoFileText({ owner: parsed.owner, repo: parsed.repo, path: p, ref: branch });
        if (remote !== String(f.content ?? "")) modified++;
      } catch (e: any) {
        const msg = String(e?.message || "");
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) localOnly++;
        else error++;
      }
    }

    let remoteOnly = 0;
    try {
      const remotePaths = await listRepoBlobPaths({ owner: parsed.owner, repo: parsed.repo, ref: branch });
      const remoteSet = new Set(remotePaths);
      // Count remote paths not present in local slice
      for (const rp of remoteSet) {
        if (rp.startsWith(".github/workflows/") && !MANAGED_WORKFLOWS.has(rp)) continue;
        if (!localPaths.has(rp)) remoteOnly++;
      }
    } catch {
      // ignore, still show local-only/modified
      error++;
    }

    commitSyncStatus({ checking: false, modified, localOnly, remoteOnly, skipped, error, checkedAt: Date.now() });
  }, [activeRepo, activeBranch, normalizedLocalFiles, listRepoBlobPaths]);

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

  // Keep a lightweight "dirty" indicator up to date when repo/branch changes.
  useEffect(() => {
    if (!activeRepo) {
      setSyncStatus(EMPTY_SYNC_STATUS);
      return;
    }
    // fire-and-forget (best-effort)
    refreshSyncStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Prefer default branch from the repo list payload (fast), fallback to API if needed.
  const defaultBranch: string | null =
    typeof repoOrString === "string"
      ? null
      : String(repoOrString.default_branch || "").trim() || null;

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
        setActiveBranch(b);
        setLinkedRepo(fullName, b);
      })
      .catch(() => {
        // non-fatal: user can still pick a branch manually
      });
  }
}, [setActiveRepo, addRecentRepo, setLinkedRepo, setActiveBranch, loadDefaultBranch]);

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
      setActiveRepo(repo.full_name);
      addRecentRepo(repo.full_name);
      const defaultBranch = String(repo.default_branch || "").trim() || null;
      setLinkedRepo(repo.full_name, defaultBranch);
      setActiveBranch(defaultBranch);
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
    } catch (e: any) {
      Alert.alert("❌ Pull fehlgeschlagen", e?.message ?? "");
      setPullModalVisible(false);
    } finally {
      setPullPreviewLoading(false);
    }
  }, [activeRepo, activeBranch, pullFromRepo, normalizedLocalFiles, pullPreviewLoading]);

  const handlePush = useCallback(async () => {
    // Push now opens options (commit message + file selection).
    if (!activeRepo || !projectFiles.length) {
      Alert.alert("⚠️", "Kein Repo/Projekt ausgewählt oder keine Dateien.");
      return;
    }
    const initial: Record<string, boolean> = {};
    for (const f of projectFiles) {
      const p = String(f.path || "").trim();
      if (!p) continue;
      initial[p] = true;
    }
    setPushSelectedPaths(initial);
    setPushModalVisible(true);
  }, [activeRepo, projectFiles]);

  /**
   * Opens the Push options modal but preselects only specific local paths.
   * Used by the Diff UI to push only changed files.
   */
  const openPushModalForPaths = useCallback(
    (paths: string[]) => {
      if (!activeRepo || !projectFiles.length) {
        Alert.alert("⚠️", "Kein Repo/Projekt ausgewählt oder keine Dateien.");
        return;
      }
      const wanted = new Set((paths || []).map((p) => String(p || "").trim()).filter(Boolean));
      const initial: Record<string, boolean> = {};

      for (const f of projectFiles) {
        const p = String(f.path || "").trim();
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
    [activeRepo, projectFiles],
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

    const selectedPaths = Object.entries(pushSelectedPaths)
      .filter(([, v]) => !!v)
      .map(([k]) => k);

    if (!selectedPaths.length) {
      Alert.alert("⚠️", "Keine Dateien ausgewählt.");
      return;
    }

    const selectedFiles: ProjectFile[] = projectFiles
      .filter((f) => selectedPaths.includes(String(f.path || "").trim()))
      .map((f) => ({ path: String(f.path || ""), content: String(f.content ?? "") }));

    setIsPushing(true);
    try {
      const branch = (activeBranch || "").trim();
      if (!branch) {
        Alert.alert("⚠️ Push", "Kein Branch ausgewählt.");
        return;
      }
      await pushFilesToRepoAdvanced(
        parsed.owner,
        parsed.repo,
        withCoreFiles(selectedFiles),
        { branch, message: pushCommitMessage || "chore: sync" },
      );
      setPushModalVisible(false);
      refreshSyncStatus();
      Alert.alert(
        "✅ Push erfolgreich",
        `${parsed.owner}/${parsed.repo}@${branch}\nHinweis: GitHub erstellt hier pro Datei einen Commit (Contents API).`,
      );
    } catch (e: any) {
      Alert.alert("❌ Push fehlgeschlagen", e?.message ?? "");
    } finally {
      setIsPushing(false);
    }
  }, [activeRepo, activeBranch, projectFiles, pushSelectedPaths, pushCommitMessage, withCoreFiles, refreshSyncStatus]);

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
      const localMap = new Map<string, ProjectFile>();
      for (const lf of normalizedLocalFiles) localMap.set(lf.path, { path: lf.path, content: lf.content });

      const remoteMap = new Map<string, ProjectFile>();
      for (const rf of pullPreview.remote) {
        const p = String(rf.path || "");
        if (!p) continue;
        remoteMap.set(p, { path: p, content: String(rf.content ?? "") });
      }

      const out: ProjectFile[] = [];
      // Start with local-only files
      for (const [p, lf] of localMap.entries()) {
        if (!remoteMap.has(p)) out.push(lf);
      }

      // Add remote files (merge strategy)
      for (const [p, rf] of remoteMap.entries()) {
        const lf = localMap.get(p);
        const isConflict = !!lf && String(lf.content ?? "") !== String(rf.content ?? "");
        if (strategy === "skipConflicts" && isConflict) out.push(lf);
        else out.push(rf);
      }

      updateProjectFiles(out);
      setPullModalVisible(false);
      setPullPreview(null);
      refreshSyncStatus();
      Alert.alert(
        "✅ Pull angewendet",
        strategy === "overwrite"
          ? "Remote Stand wurde übernommen (Konflikte überschrieben)."
          : "Konflikte wurden übersprungen (lokal behalten).",
      );
    } catch (e: any) {
      Alert.alert("❌ Pull Anwenden fehlgeschlagen", e?.message ?? "");
    } finally {
      setIsPulling(false);
    }
  }, [pullPreview, normalizedLocalFiles, updateProjectFiles, refreshSyncStatus]);

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
      const branch = (activeBranch || "").trim();
      if (!branch) {
        Alert.alert("⚠️", "Kein Branch ausgewählt.");
        return;
      }
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

      setEasLinkStatus("ok");
      Alert.alert("✅ EAS linked", `EAS Project ID geschrieben nach ${easProjectJsonPath}`);
    } catch (e: any) {
      Alert.alert("❌ EAS link fehlgeschlagen", e?.message ?? "");
    } finally {
      setIsEasLinking(false);
    }
  }, [activeRepo, activeBranch, easProjectId]);

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
    // local project
    projectFiles,

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
    setManageValue,
    closeManageModal,
  };
}
