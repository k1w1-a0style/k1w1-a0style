/* eslint-disable react/no-unescaped-entities */
// screens/GitHubReposScreen.tsx - Vereinfachtes Layout

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  ScrollView,
  Alert,
  Linking,
  RefreshControl,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../lib/storageKeys";

import { useGitHub } from "../contexts/GitHubContext";
import { useProject, getGitHubToken } from "../contexts/ProjectContext";
import {
  createRepo,
  cleanupNativeDirsInRepo,
  pushFilesToRepo,
  deleteRepo as deleteGitHubRepo,
  renameRepo as renameGitHubRepo,
  createBranch,
  deleteBranch,
  renameBranch,
  getRepoFileText,
  createOrUpdateFile,
  triggerWorkflow,
} from "../contexts/githubService";

import { autoSyncRepoSecrets } from "../lib/autoSyncRepoSecrets";
import { useGitHubRepos, GitHubRepo } from "../hooks/useGitHubRepos";
import { theme } from "../theme";

import { BranchSelector } from "./GitHubReposScreen/components/BranchSelector";
import { WorkflowRunsSection } from "./GitHubReposScreen/components/WorkflowRunsSection";

import {
  combineRepos,
  splitFullName,
  isValidRepoName,
} from "./GitHubReposScreen/utils/repos";
import { runTemplateHardChecklist, resolveEffectiveTemplateId } from "../lib/templateChecklist";
import type { TemplateId, CoreTemplateId } from "../contexts/types";

type TemplateFile = { path: string; content: string };

const loadCoreTemplateFiles = (templateId: CoreTemplateId = "navigation"): TemplateFile[] => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const template = (
      templateId === "full"
        ? require("../templates/expo-sdk54-full.json")
        : templateId === "navigation"
          ? require("../templates/expo-sdk54-navigation.json")
          : templateId === "crud"
            ? require("../templates/expo-sdk54-crud.json")
            : require("../templates/expo-sdk54-base.json")
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

const getCoreFileContent = (path: string, templateId: CoreTemplateId = "base"): string | null => {
  const files = loadCoreTemplateFiles(templateId);
  const hit = files.find((f) => f.path === path);
  return hit?.content ?? null;
};

export default function GitHubReposScreen() {
  const {
    activeRepo,
    setActiveRepo,
    activeBranch,
    setActiveBranch,
    addRecentRepo,
  } = useGitHub();
  const { projectData, updateProjectFiles, setLinkedRepo } = useProject();
  const templateId: TemplateId = ((projectData?.templateId as TemplateId) || "auto");
  const effectiveTemplateId: CoreTemplateId = resolveEffectiveTemplateId(templateId, (projectData?.files || []) as any).effective;

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
  const [busy, setBusy] = useState(false);
  const [pullProgress, setPullProgress] = useState("");

  const [easProjectId, setEasProjectId] = useState<string>("");
  const [isEasLinking, setIsEasLinking] = useState(false);
  const [easLinkStatus, setEasLinkStatus] = useState<
    "unknown" | "ok" | "missing"
  >("unknown");

  // Manage Modal (für Repo/Branch Aktionen)
  type ManageModalConfig = {
    title: string;
    placeholder: string;
    initialValue?: string;
    confirmText?: string;
    action: (value: string) => Promise<void>;
  };

  const [manageModal, setManageModal] = useState<ManageModalConfig | null>(
    null,
  );
  const [manageValue, setManageValue] = useState("");

  const openManageModal = useCallback((cfg: ManageModalConfig) => {
    setManageValue(cfg.initialValue ?? "");
    setManageModal(cfg);
  }, []);

  const closeManageModal = useCallback(() => {
    setManageModal(null);
    setManageValue("");
  }, []);

  // Token laden
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

  // EAS Project ID aus Storage (optional)
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

  // Auto-Load Repos
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

  // Verknüpftes Repo wiederherstellen
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
      // Direkt auswählen
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

  
  const handleCleanupNative = useCallback(async () => {
    if (!activeRepo) {
      Alert.alert("Kein Repo ausgewählt", "Bitte wähle zuerst ein Repository aus.");
      return;
    }
    const parsed = splitFullName(activeRepo);
    if (!parsed) return;
    const { owner, repo } = parsed;
    const branch = activeBranch || "main";
    if (!owner || !repo) {
      Alert.alert("Ungültiges Repo", "Konnte owner/repo nicht auflösen.");
      return;
    }

    Alert.alert(
      "Native Ordner entfernen?",
      `Ich lösche android/ und ios/ aus ${owner}/${repo}@${branch}.

Das ist nötig für managed EAS builds (sonst sucht EAS build.gradle).`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            try {
              setBusy(true);
              const res = await cleanupNativeDirsInRepo({ owner, repo, branch });
              Alert.alert(
                "Cleanup fertig",
                `Gelöscht: ${res.deleted}\nÜbersprungen: ${res.skipped}\n\nDanach am besten nochmal Push/Build starten.`
              );
            } catch (e: any) {
              Alert.alert("Cleanup fehlgeschlagen", e?.message ?? String(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }, [activeRepo, activeBranch]);

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
  }, [activeRepo, activeBranch, projectData?.files]);

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
      // 404 -> missing
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

      // 1) ensure workflow exists (auto-fix)
      try {
        await getRepoFileText({
          owner: parsed.owner,
          repo: parsed.repo,
          path: ".github/workflows/eas-link.yml",
          ref: branch,
        });
      } catch (e: any) {
        const content = getCoreFileContent(".github/workflows/eas-link.yml", effectiveTemplateId);
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

      // 2) trigger workflow
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
  }, [activeRepo, activeBranch, token, easProjectId]);

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
        // res.full_name = owner/newName
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
      { text: "Cleanup native (android/ios)", onPress: handleCleanupNative },
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
    handleCleanupNative,
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

  // UI Rendering
  const renderActiveRepo = () => {
    if (!activeRepo) {
      return (
        <TouchableOpacity
          style={s.selectRepoBtn}
          onPress={() => setShowRepoList(true)}
        >
          <Ionicons
            name="git-branch-outline"
            size={20}
            color={theme.palette.primary}
          />
          <Text style={s.selectRepoBtnText}>Repository auswählen</Text>
          <Ionicons
            name="chevron-down"
            size={16}
            color={theme.palette.text.secondary}
          />
        </TouchableOpacity>
      );
    }

    return (
      <View style={s.activeRepoCard}>
        <TouchableOpacity
          style={s.repoHeader}
          onPress={() => setShowRepoList(true)}
        >
          <View style={s.repoInfo}>
            <Ionicons
              name="git-branch"
              size={18}
              color={theme.palette.primary}
            />
            <Text style={s.repoName} numberOfLines={1}>
              {activeRepo}
            </Text>
          </View>
          <Ionicons
            name="swap-horizontal"
            size={18}
            color={theme.palette.text.secondary}
          />
        </TouchableOpacity>

        {/* Quick Actions */}
        <View style={s.quickActions}>
          <TouchableOpacity
            style={[s.actionBtn, isPushing && s.actionBtnDisabled]}
            onPress={handlePush}
            disabled={isPushing}
          >
            {isPushing ? (
              <ActivityIndicator size="small" color={theme.palette.primary} />
            ) : (
              <>
                <Ionicons
                  name="cloud-upload-outline"
                  size={16}
                  color={theme.palette.primary}
                />
                <Text style={s.actionBtnText}>Push</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.actionBtn, isPulling && s.actionBtnDisabled]}
            onPress={handlePull}
            disabled={isPulling}
          >
            {isPulling ? (
              <ActivityIndicator size="small" color={theme.palette.primary} />
            ) : (
              <>
                <Ionicons
                  name="cloud-download-outline"
                  size={16}
                  color={theme.palette.primary}
                />
                <Text style={s.actionBtnText}>Pull</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn} onPress={openOnGitHub}>
            <Ionicons
              name="open-outline"
              size={16}
              color={theme.palette.primary}
            />
            <Text style={s.actionBtnText}>GitHub</Text>
          </TouchableOpacity>
        </View>

        {/* More Actions */}
        <View style={s.moreActions}>
          <TouchableOpacity style={s.actionBtn} onPress={handleSyncSecrets}>
            <Ionicons
              name="sync-outline"
              size={16}
              color={theme.palette.primary}
            />
            <Text style={s.actionBtnText}>Secrets</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.actionBtn, isEasLinking && s.actionBtnDisabled]}
            onPress={handleEasLink}
            disabled={isEasLinking}
          >
            {isEasLinking ? (
              <ActivityIndicator size="small" color={theme.palette.primary} />
            ) : (
              <>
                <Ionicons
                  name="rocket-outline"
                  size={16}
                  color={theme.palette.primary}
                />
                <Text style={s.actionBtnText}>EAS Link</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn} onPress={openManageMenu}>
            <Ionicons
              name="settings-outline"
              size={16}
              color={theme.palette.primary}
            />
            <Text style={s.actionBtnText}>Manage</Text>
          </TouchableOpacity>
        </View>

        <View style={s.easStatusRow}>
          <View
            style={[
              s.statusDot,
              {
                backgroundColor:
                  easLinkStatus === "ok"
                    ? theme.palette.success
                    : easLinkStatus === "missing"
                      ? theme.palette.error
                      : theme.palette.text.muted,
              },
            ]}
          />
          <Text style={s.easStatusText}>
            {easLinkStatus === "ok"
              ? "Workflow eas-link.yml vorhanden"
              : easLinkStatus === "missing"
                ? "Workflow eas-link.yml fehlt (wird bei EAS Link auto-gefixt)"
                : "Workflow-Status: unbekannt"}
          </Text>
        </View>

        {pullProgress ? (
          <Text style={s.progressText}>{pullProgress}</Text>
        ) : null}
      </View>
    );
  };

  const renderRepoList = () => {
    if (!showRepoList) return null;

    return (
      <View style={s.repoListOverlay}>
        <View style={s.repoListHeader}>
          <Text style={s.repoListTitle}>Repository wählen</Text>
          <TouchableOpacity onPress={() => setShowRepoList(false)}>
            <Ionicons
              name="close"
              size={24}
              color={theme.palette.text.primary}
            />
          </TouchableOpacity>
        </View>

        <TextInput
          style={s.searchInput}
          placeholder="🔍 Suchen..."
          placeholderTextColor={theme.palette.text.secondary}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />

        <ScrollView
          style={s.repoListScroll}
          showsVerticalScrollIndicator={false}
        >
          {loadingRepos && (
            <View style={s.loadingRow}>
              <ActivityIndicator size="small" color={theme.palette.primary} />
              <Text style={s.loadingText}>Lade Repos...</Text>
            </View>
          )}

          {filteredRepos.map((repo) => (
            <TouchableOpacity
              key={repo.id}
              style={[
                s.repoItem,
                repo.full_name === activeRepo && s.repoItemActive,
              ]}
              onPress={() => handleSelectRepo(repo)}
            >
              <Ionicons
                name={repo.private ? "lock-closed" : "globe-outline"}
                size={14}
                color={theme.palette.text.secondary}
              />
              <Text style={s.repoItemText} numberOfLines={1}>
                {repo.full_name}
              </Text>
              {repo.full_name === activeRepo && (
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={theme.palette.primary}
                />
              )}
            </TouchableOpacity>
          ))}

          {filteredRepos.length === 0 && !loadingRepos && (
            <Text style={s.emptyText}>Keine Repos gefunden</Text>
          )}
        </ScrollView>

        <TouchableOpacity
          style={s.newRepoBtn}
          onPress={() => {
            setShowRepoList(false);
            setShowNewRepo(true);
          }}
        >
          <Ionicons
            name="add-circle-outline"
            size={18}
            color={theme.palette.primary}
          />
          <Text style={s.newRepoBtnText}>Neues Repo erstellen</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderNewRepoModal = () => {
    if (!showNewRepo) return null;

    return (
      <View style={s.newRepoOverlay}>
        <View style={s.newRepoCard}>
          <Text style={s.newRepoTitle}>Neues Repository</Text>
          <TextInput
            style={s.newRepoInput}
            placeholder="repo-name"
            placeholderTextColor={theme.palette.text.secondary}
            value={newRepoName}
            onChangeText={setNewRepoName}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={s.newRepoActions}>
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={() => setShowNewRepo(false)}
            >
              <Text style={s.cancelBtnText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.createBtn, isCreating && s.actionBtnDisabled]}
              onPress={handleCreateRepo}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={s.createBtnText}>Erstellen</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Main Render
  if (tokenLoading) {
    return (
      <SafeAreaView style={s.screen} edges={["top"]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.palette.primary} />
          <Text style={s.loadingText}>Lade Token...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={s.screen} edges={["top"]}>
        <View style={s.center}>
          <Ionicons
            name="key-outline"
            size={48}
            color={theme.palette.text.secondary}
          />
          <Text style={s.noTokenTitle}>Kein GitHub Token</Text>
          <Text style={s.noTokenText}>
            Bitte hinterlege dein GitHub Personal Access Token im
            Verbindungen-Screen.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.palette.primary]}
            tintColor={theme.palette.primary}
          />
        }
      >
        {/* Header */}
        <View style={s.header}>
          <Ionicons
            name="logo-github"
            size={28}
            color={theme.palette.primary}
          />
          <View style={s.headerText}>
            <Text style={s.headerTitle}>GitHub</Text>
            <Text style={s.headerSub}>{repos.length} Repos</Text>
          </View>
        </View>

        {/* Active Repo Card */}
        {renderActiveRepo()}

        {/* Branch Selector - nur wenn Repo ausgewählt */}
        {activeRepo && (
          <BranchSelector
            activeRepo={activeRepo}
            activeBranch={activeBranch}
            onSelectBranch={handleSelectBranch}
            loadBranches={loadBranches}
            loadDefaultBranch={loadDefaultBranch}
          />
        )}

        {/* Workflow Runs - nur wenn Repo ausgewählt */}
        {activeRepo && (
          <WorkflowRunsSection
            activeRepo={activeRepo}
            loadWorkflowRuns={loadWorkflowRuns}
          />
        )}
      </ScrollView>

      {/* Overlays */}
      {renderRepoList()}
      {renderNewRepoModal()}

      {/* Manage Modal */}
      {manageModal ? (
        <View style={s.newRepoOverlay}>
          <View style={s.newRepoCard}>
            <Text style={s.newRepoTitle}>{manageModal.title}</Text>
            <TextInput
              style={s.newRepoInput}
              placeholder={manageModal.placeholder}
              placeholderTextColor={theme.palette.text.secondary}
              value={manageValue}
              onChangeText={setManageValue}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={s.newRepoActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={closeManageModal}>
                <Text style={s.cancelBtnText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.createBtn}
                onPress={async () => {
                  try {
                    await manageModal.action(manageValue);
                  } catch (e: any) {
                    Alert.alert("❌ Fehler", e?.message ?? "");
                  }
                }}
              >
                <Text style={s.createBtnText}>
                  {manageModal.confirmText ?? "OK"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// Lokale Styles
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.palette.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  headerText: { flex: 1 },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.palette.text.primary,
  },
  headerSub: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginTop: 2,
  },

  selectRepoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    backgroundColor: theme.palette.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderStyle: "dashed",
  },
  selectRepoBtnText: {
    flex: 1,
    fontSize: 15,
    color: theme.palette.text.secondary,
  },

  activeRepoCard: {
    backgroundColor: theme.palette.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.palette.primary,
    padding: 14,
    marginBottom: 12,
  },
  repoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  repoInfo: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  repoName: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.palette.text.primary,
    flex: 1,
  },

  quickActions: { flexDirection: "row", gap: 8, marginTop: 14 },
  moreActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    backgroundColor: theme.palette.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.palette.primary,
  },

  progressText: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    marginTop: 8,
    textAlign: "center",
  },

  // Repo List Overlay
  repoListOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.palette.background,
    padding: 16,
    paddingTop: 8,
  },
  repoListHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  repoListTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.palette.text.primary,
  },
  searchInput: {
    backgroundColor: theme.palette.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.palette.text.primary,
    marginBottom: 12,
  },
  repoListScroll: { flex: 1 },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  loadingText: { fontSize: 13, color: theme.palette.text.secondary },
  repoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    backgroundColor: theme.palette.card,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  repoItemActive: {
    borderColor: theme.palette.primary,
    backgroundColor: theme.palette.secondary,
  },
  repoItemText: { flex: 1, fontSize: 14, color: theme.palette.text.primary },
  emptyText: {
    textAlign: "center",
    color: theme.palette.text.secondary,
    padding: 24,
  },
  newRepoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    marginTop: 12,
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.primary,
  },
  newRepoBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.palette.primary,
  },

  // New Repo Modal
  newRepoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  newRepoCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: theme.palette.card,
    borderRadius: 16,
    padding: 20,
  },
  newRepoTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.palette.text.primary,
    marginBottom: 16,
  },
  newRepoInput: {
    backgroundColor: theme.palette.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.palette.text.primary,
    marginBottom: 16,
  },
  newRepoActions: { flexDirection: "row", gap: 10 },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.palette.text.secondary,
  },
  createBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: theme.palette.primary,
  },
  createBtnText: { fontSize: 14, fontWeight: "800", color: "#000" },

  noTokenTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.palette.text.primary,
    marginTop: 12,
  },
  noTokenText: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    textAlign: "center",
    lineHeight: 20,
  },
  easStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingVertical: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 99,
    backgroundColor: theme.palette.text.muted,
  },
  easStatusText: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "700",
  },
});
