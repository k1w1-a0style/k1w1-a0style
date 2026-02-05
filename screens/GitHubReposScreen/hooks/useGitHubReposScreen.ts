import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../../../lib/storageKeys";
import { useGitHub } from "../../../contexts/GitHubContext";
import { useProject, getGitHubToken } from "../../../contexts/ProjectContext";
import {
  createRepo,
  pushFilesToRepo,
  deleteRepo as deleteGitHubRepo,
  renameRepo as renameGitHubRepo,
  createBranch,
  deleteBranch,
  renameBranch,
  getRepoFileText,
  createOrUpdateFile,
  triggerWorkflow,
} from "../../../contexts/githubService";
import { autoSyncRepoSecrets } from "../../../lib/autoSyncRepoSecrets";
import { useGitHubRepos, GitHubRepo } from "../../../hooks/useGitHubRepos";
import { runTemplateHardChecklist, resolveEffectiveTemplateId } from "../../../lib/templateChecklist";
import type { TemplateId, CoreTemplateId } from "../../../contexts/types";
import { combineRepos, isValidRepoName, splitFullName } from "../utils/repos";

type TemplateFile = { path: string; content: string };

type ManageModalConfig = {
  title: string;
  placeholder: string;
  initialValue?: string;
  confirmText?: string;
  action: (value: string) => Promise<void>;
};

const loadCoreTemplateFiles = (
  templateId: CoreTemplateId = "navigation",
): TemplateFile[] => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const template = (
      templateId === "full"
        ? require("../../../templates/expo-sdk54-full.json")
        : templateId === "navigation"
          ? require("../../../templates/expo-sdk54-navigation.json")
          : templateId === "crud"
            ? require("../../../templates/expo-sdk54-crud.json")
            : require("../../../templates/expo-sdk54-base.json")
    ) as any[];
    if (!Array.isArray(template)) return [];
    const mapped = template
      .filter((f) => f && typeof f.path === "string")
      .map((f) => ({
        path: String(f.path),
        content:
          typeof f.content === "string"
            ? f.content
            : JSON.stringify(f.content ?? "", null, 2),
      }));

    // Core-Template Dateien sollen nie "halbkaputt" sein.
    // Autofix: wir nutzen hier nur die gefixten Inhalte als Quelle für Core-Workflows.
    const checked = runTemplateHardChecklist(
      mapped.map((f) => ({ path: f.path, content: f.content })),
      { autofix: true },
    );

    return checked.files.map((f) => ({ path: f.path, content: f.content }));
  } catch {
    return [];
  }
};

const CORE_PATHS = [
  ".github/workflows/eas-link.yml",
  ".github/workflows/eas-build.yml",
  ".github/workflows/k1w1-triggered-build.yml",
  ".github/workflows/deploy-supabase-functions.yml",
] as const;

const getCoreFileContent = (
  path: string,
  templateId: CoreTemplateId = "base",
): string | null => {
  const files = loadCoreTemplateFiles(templateId);
  const hit = files.find((f) => f.path === path);
  return hit?.content ?? null;
};

export function useGitHubReposScreen() {
  const {
    activeRepo,
    setActiveRepo,
    activeBranch,
    setActiveBranch,
    addRecentRepo,
  } = useGitHub();
  const { projectData, updateProjectFiles, setLinkedRepo } = useProject();
  const templateId: TemplateId =
    ((projectData?.templateId as TemplateId) || "auto");
  const effectiveTemplateId: CoreTemplateId = resolveEffectiveTemplateId(
    templateId,
    (projectData?.files || []) as any,
  ).effective;

  const [token, setToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasAutoLoaded = useRef(false);
  const hasRestoredLink = useRef(false);

  const [showRepoList, setShowRepoList] = useState(false);
  const [showNewRepo, setShowNewRepo] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const {
    repos,
    loading: loadingRepos,
    loadRepos,
    pullFromRepo,
    loadBranches,
    loadWorkflowRuns,
    loadDefaultBranch,
  } = useGitHubRepos(token);

  const [localRepos, setLocalRepos] = useState<GitHubRepo[]>([]);
  const [newRepoName, setNewRepoName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pullProgress, setPullProgress] = useState("");

  const [easProjectId, setEasProjectId] = useState<string>("");
  const [isEasLinking, setIsEasLinking] = useState(false);
  const [easLinkStatus, setEasLinkStatus] = useState<
    "unknown" | "ok" | "missing"
  >("unknown");

  const [manageModal, setManageModal] = useState<ManageModalConfig | null>(
    null,
  );
  const [manageValue, setManageValue] = useState("");

  const openRepoList = useCallback(() => {
    setShowRepoList(true);
  }, []);

  const closeRepoList = useCallback(() => {
    setShowRepoList(false);
  }, []);

  const openNewRepoModal = useCallback(() => {
    setShowRepoList(false);
    setShowNewRepo(true);
  }, []);

  const closeNewRepoModal = useCallback(() => {
    setShowNewRepo(false);
  }, []);

  const openManageModal = useCallback((cfg: ManageModalConfig) => {
    setManageValue(cfg.initialValue ?? "");
    setManageModal(cfg);
  }, []);

  const closeManageModal = useCallback(() => {
    setManageModal(null);
    setManageValue("");
  }, []);

  useEffect(() => {
    const loadToken = async () => {
      setTokenLoading(true);
      try {
        const t = await getGitHubToken();
        setToken(t);
        console.log("[GitHubReposScreen] 🔑 Token geladen:", !!t);
      } catch (e) {
        console.error("[GitHubReposScreen] ❌ Token-Fehler:", e);
      } finally {
        setTokenLoading(false);
      }
    };
    loadToken();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const id = await AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID).catch(
        () => "",
      );
      if (!mounted) return;
      setEasProjectId((id || "").trim());
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (
      token &&
      !hasAutoLoaded.current &&
      repos.length === 0 &&
      !loadingRepos
    ) {
      hasAutoLoaded.current = true;
      console.log("[GitHubReposScreen] 🔄 Auto-Load Repos gestartet");
      loadRepos();
    }
  }, [token, repos.length, loadingRepos, loadRepos]);

  useEffect(() => {
    if (!hasRestoredLink.current && projectData?.linkedRepo && !activeRepo) {
      hasRestoredLink.current = true;
      setActiveRepo(projectData.linkedRepo);
      if (projectData.linkedBranch) setActiveBranch(projectData.linkedBranch);
    }
  }, [projectData, activeRepo, setActiveRepo, setActiveBranch]);

  const handleRefresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    await loadRepos();
    setRefreshing(false);
  }, [token, loadRepos]);

  const handleSelectRepo = useCallback(
    (repo: GitHubRepo) => {
      setActiveRepo(repo.full_name);
      addRecentRepo(repo.full_name);
      setLinkedRepo(repo.full_name, null);
      setActiveBranch(null);
      setShowRepoList(false);
    },
    [setActiveRepo, addRecentRepo, setLinkedRepo, setActiveBranch],
  );

  const handleSelectBranch = useCallback(
    (branch: string) => {
      setActiveBranch(branch);
      if (activeRepo) setLinkedRepo(activeRepo, branch);
    },
    [setActiveBranch, activeRepo, setLinkedRepo],
  );

  const handleCreateRepo = useCallback(async () => {
    const name = newRepoName.trim();
    const validation = isValidRepoName(name);
    if (!validation.valid) {
      Alert.alert("❌ Ungültiger Name", validation.error ?? "");
      return;
    }
    if (!token) {
      Alert.alert(
        "❌ Kein Token",
        "Bitte GitHub Token im Verbindungen-Screen hinterlegen.",
      );
      return;
    }
    setIsCreating(true);
    try {
      const repo = await createRepo(name, true);
      setLocalRepos((prev) => [repo, ...prev]);
      setNewRepoName("");
      setShowNewRepo(false);
      await loadRepos();
      handleSelectRepo(repo);
      Alert.alert("✅ Erstellt", `Repository "${name}" wurde angelegt.`);
    } catch (e: any) {
      Alert.alert("❌ Fehler", e?.message ?? "Erstellen fehlgeschlagen.");
    } finally {
      setIsCreating(false);
    }
  }, [newRepoName, token, loadRepos, handleSelectRepo]);

  const withCoreFiles = useCallback(
    (files: Array<{ path: string; content: string }>) => {
      const out = [...files];
      const seen = new Set(out.map((f) => f.path));
      for (const p of CORE_PATHS) {
        if (seen.has(p)) continue;
        const c = getCoreFileContent(p, effectiveTemplateId);
        if (!c) continue;
        out.push({ path: p, content: c });
        seen.add(p);
      }
      return out;
    },
    [effectiveTemplateId],
  );

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
        branch,
      );
      Alert.alert(
        "✅ Push erfolgreich",
        `Dateien nach ${activeRepo} (Branch: ${activeBranch ?? "main"}) gepusht.`,
      );
    } catch (e: any) {
      Alert.alert("❌ Push Fehler", e?.message ?? "");
    } finally {
      setIsPushing(false);
    }
  }, [activeRepo, activeBranch, projectData?.files, withCoreFiles]);

  const checkEasLinkWorkflow = useCallback(async () => {
    if (!activeRepo || !token) {
      setEasLinkStatus("unknown");
      return;
    }
    const parsed = splitFullName(activeRepo);
    if (!parsed) {
      setEasLinkStatus("unknown");
      return;
    }
    const branch = activeBranch ?? "main";
    try {
      await getRepoFileText({
        owner: parsed.owner,
        repo: parsed.repo,
        path: ".github/workflows/eas-link.yml",
        ref: branch,
      });
      setEasLinkStatus("ok");
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
        setEasLinkStatus("missing");
      } else {
        setEasLinkStatus("unknown");
      }
    }
  }, [activeRepo, activeBranch, token]);

  useEffect(() => {
    checkEasLinkWorkflow().catch(() => {});
  }, [checkEasLinkWorkflow]);

  const handleEasLink = useCallback(async () => {
    if (!activeRepo) {
      Alert.alert("⚠️", "Bitte erst Repo auswählen.");
      return;
    }
    if (!token) {
      Alert.alert("⚠️", "GitHub Token fehlt (Connections Screen).");
      return;
    }
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;

    setIsEasLinking(true);
    try {
      const branch = activeBranch ?? "main";

      try {
        await getRepoFileText({
          owner: parsed.owner,
          repo: parsed.repo,
          path: ".github/workflows/eas-link.yml",
          ref: branch,
        });
      } catch (e: any) {
        const content = getCoreFileContent(
          ".github/workflows/eas-link.yml",
          effectiveTemplateId,
        );
        if (!content) {
          throw new Error("Konnte eas-link.yml nicht aus dem Template laden.");
        }
        await createOrUpdateFile(
          parsed.owner,
          parsed.repo,
          ".github/workflows/eas-link.yml",
          content,
          "chore(ci): add eas-link workflow",
          branch,
        );
      }

      await triggerWorkflow(parsed.owner, parsed.repo, "eas-link.yml", branch, {
        eas_project_id: (easProjectId || "").trim(),
      });

      setEasLinkStatus("ok");
      Alert.alert(
        "✅ EAS Link gestartet",
        "Workflow 'eas-link.yml' wurde gestartet. Check die Runs unten oder in GitHub Actions.",
      );
    } catch (e: any) {
      Alert.alert("❌ initEasProject", e?.message ?? "Fehler");
    } finally {
      setIsEasLinking(false);
    }
  }, [activeRepo, activeBranch, token, easProjectId, effectiveTemplateId]);

  const handlePull = useCallback(async () => {
    if (!token || !activeRepo) {
      Alert.alert("⚠️", "Kein Token/Repo.");
      return;
    }
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;
    setIsPulling(true);
    const files = await pullFromRepo(
      parsed.owner,
      parsed.repo,
      setPullProgress,
    );
    setIsPulling(false);
    setPullProgress("");
    if (files && files.length > 0) {
      await updateProjectFiles(files as any, parsed.repo);
      Alert.alert("✅ Pull erfolgreich", `${files.length} Dateien geladen.`);
    }
  }, [token, activeRepo, pullFromRepo, updateProjectFiles]);

  const handleSyncSecrets = useCallback(async () => {
    if (!activeRepo) {
      Alert.alert("⚠️", "Bitte zuerst ein Repository auswählen.");
      return;
    }
    try {
      const result = await autoSyncRepoSecrets(activeRepo);
      if (result.updated.length === 0) {
        Alert.alert(
          "ℹ️ Secrets",
          "Keine Secrets zum Synchronisieren gefunden.",
        );
      } else {
        Alert.alert("✅ Secrets synchronisiert", result.updated.join(", "));
      }
    } catch (e: any) {
      Alert.alert("❌ Secrets Sync fehlgeschlagen", e?.message ?? "");
    }
  }, [activeRepo]);

  const handleDeleteRepo = useCallback(async () => {
    if (!activeRepo) return;
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;

    Alert.alert(
      "Repo löschen?",
      `Das Repository "${activeRepo}" wird dauerhaft gelöscht.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            try {
              const ok = await deleteGitHubRepo(parsed.owner, parsed.repo);
              if (!ok) {
                Alert.alert("⚠️", "Repo nicht gefunden oder kein Zugriff.");
                return;
              }
              setActiveRepo(null);
              setActiveBranch(null);
              setLinkedRepo(null, null);
              await loadRepos();
              Alert.alert("✅ Gelöscht", "Repository wurde gelöscht.");
            } catch (e: any) {
              Alert.alert("❌ Fehler", e?.message ?? "");
            }
          },
        },
      ],
    );
  }, [activeRepo, loadRepos, setActiveRepo, setActiveBranch, setLinkedRepo]);

  const handleRenameRepo = useCallback(() => {
    if (!activeRepo) return;
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;

    openManageModal({
      title: "Repo umbenennen",
      placeholder: "neuer-repo-name",
      initialValue: parsed.repo,
      confirmText: "Umbenennen",
      action: async (newName: string) => {
        const res = await renameGitHubRepo(parsed.owner, parsed.repo, newName);
        setActiveRepo(res.full_name);
        addRecentRepo(res.full_name);
        setLinkedRepo(res.full_name, activeBranch ?? null);
        await loadRepos();
        closeManageModal();
        Alert.alert("✅ Umbenannt", res.full_name);
      },
    });
  }, [
    activeRepo,
    activeBranch,
    addRecentRepo,
    closeManageModal,
    loadRepos,
    openManageModal,
    setActiveRepo,
    setLinkedRepo,
  ]);

  const handleCreateBranch = useCallback(async () => {
    if (!activeRepo) return;
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;

    const base =
      activeBranch || (await loadDefaultBranch(parsed.owner, parsed.repo));

    openManageModal({
      title: "Branch erstellen",
      placeholder: "neuer-branch-name",
      confirmText: "Erstellen",
      action: async (newBranchName: string) => {
        await createBranch(parsed.owner, parsed.repo, newBranchName, base);
        closeManageModal();
        await loadBranches(parsed.owner, parsed.repo);
        Alert.alert("✅ Branch erstellt", `${newBranchName} (von ${base})`);
      },
    });
  }, [
    activeRepo,
    activeBranch,
    closeManageModal,
    loadBranches,
    loadDefaultBranch,
    openManageModal,
  ]);

  const handleDeleteBranch = useCallback(async () => {
    if (!activeRepo) return;
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;

    const branch = activeBranch;
    if (!branch) {
      Alert.alert("⚠️", "Bitte zuerst einen Branch auswählen.");
      return;
    }

    Alert.alert("Branch löschen?", `Branch "${branch}" wird gelöscht.`, [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen",
        style: "destructive",
        onPress: async () => {
          try {
            const ok = await deleteBranch(parsed.owner, parsed.repo, branch);
            if (!ok) {
              Alert.alert("⚠️", "Branch nicht gefunden oder kein Zugriff.");
              return;
            }
            setActiveBranch(null);
            await loadBranches(parsed.owner, parsed.repo);
            Alert.alert("✅ Gelöscht", `Branch "${branch}" wurde gelöscht.`);
          } catch (e: any) {
            Alert.alert("❌ Fehler", e?.message ?? "");
          }
        },
      },
    ]);
  }, [activeRepo, activeBranch, loadBranches, setActiveBranch]);

  const handleRenameBranch = useCallback(() => {
    if (!activeRepo) return;
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;

    const branch = activeBranch;
    if (!branch) {
      Alert.alert("⚠️", "Bitte zuerst einen Branch auswählen.");
      return;
    }

    openManageModal({
      title: "Branch umbenennen",
      placeholder: "neuer-branch-name",
      initialValue: branch,
      confirmText: "Umbenennen",
      action: async (newName: string) => {
        const res = await renameBranch(
          parsed.owner,
          parsed.repo,
          branch,
          newName,
        );
        setActiveBranch(res.name);
        closeManageModal();
        await loadBranches(parsed.owner, parsed.repo);
        Alert.alert("✅ Umbenannt", res.name);
      },
    });
  }, [
    activeRepo,
    activeBranch,
    closeManageModal,
    loadBranches,
    openManageModal,
    setActiveBranch,
  ]);

  const openManageMenu = useCallback(() => {
    if (!activeRepo) return;

    const buttons: any[] = [
      { text: "Sync Secrets", onPress: handleSyncSecrets },
      { text: "Repo umbenennen", onPress: handleRenameRepo },
      { text: "Repo löschen", style: "destructive", onPress: handleDeleteRepo },
      { text: "Branch erstellen", onPress: handleCreateBranch },
      { text: "Branch umbenennen", onPress: handleRenameBranch },
      {
        text: "Branch löschen",
        style: "destructive",
        onPress: handleDeleteBranch,
      },
      { text: "Abbrechen", style: "cancel" },
    ];

    Alert.alert("Repository Aktionen", activeRepo, buttons);
  }, [
    activeRepo,
    handleCreateBranch,
    handleDeleteBranch,
    handleDeleteRepo,
    handleRenameBranch,
    handleRenameRepo,
    handleSyncSecrets,
  ]);

  const openOnGitHub = useCallback(() => {
    if (!activeRepo) return;
    Linking.openURL(`https://github.com/${activeRepo}`);
  }, [activeRepo]);

  const allRepos = useMemo(
    () => combineRepos(repos, localRepos),
    [repos, localRepos],
  );

  const filteredRepos = useMemo(() => {
    if (!searchTerm.trim()) return allRepos;
    const term = searchTerm.toLowerCase();
    return allRepos.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.full_name.toLowerCase().includes(term),
    );
  }, [allRepos, searchTerm]);

  return {
    activeRepo,
    activeBranch,
    repos,
    token,
    tokenLoading,
    refreshing,
    showRepoList,
    showNewRepo,
    searchTerm,
    newRepoName,
    isCreating,
    isPulling,
    isPushing,
    pullProgress,
    isEasLinking,
    easLinkStatus,
    loadingRepos,
    filteredRepos,
    manageModal,
    manageValue,
    setManageValue,
    setSearchTerm,
    setNewRepoName,
    closeManageModal,
    openRepoList,
    closeRepoList,
    openNewRepoModal,
    closeNewRepoModal,
    handleRefresh,
    handleSelectRepo,
    handleSelectBranch,
    handleCreateRepo,
    handlePush,
    handlePull,
    handleSyncSecrets,
    handleEasLink,
    openManageMenu,
    openOnGitHub,
    loadBranches,
    loadDefaultBranch,
    loadWorkflowRuns,
  };
}
