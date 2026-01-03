/* eslint-disable react/no-unescaped-entities */
// screens/GitHubReposScreen.tsx

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { ScrollView, Alert, Linking, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useGitHub } from "../contexts/GitHubContext";
import { useProject, getGitHubToken } from "../contexts/ProjectContext";
import { createRepo, pushFilesToRepo } from "../contexts/githubService";
import { useGitHubRepos, GitHubRepo } from "../hooks/useGitHubRepos";
import { theme } from "../theme";

import { HeaderSection } from "./GitHubReposScreen/components/HeaderSection";
import { TokenStatusSection } from "./GitHubReposScreen/components/TokenStatusSection";
import { FilterSection } from "./GitHubReposScreen/components/FilterSection";
import { RepoListSection } from "./GitHubReposScreen/components/RepoListSection";
import { NewRepoSection } from "./GitHubReposScreen/components/NewRepoSection";
import { RenameRepoSection } from "./GitHubReposScreen/components/RenameRepoSection";
import { ActionsSection } from "./GitHubReposScreen/components/ActionsSection";

import { RepoFilterType } from "./GitHubReposScreen/types";
import { styles } from "./GitHubReposScreen/styles";
import {
  combineRepos,
  filterRepos,
  splitFullName,
  deriveRenameDefault,
  isValidRepoName,
} from "./GitHubReposScreen/utils/repos";

export default function GitHubReposScreen() {
  const {
    activeRepo,
    setActiveRepo,
    recentRepos,
    addRecentRepo,
    clearRecentRepos,
  } = useGitHub();
  const { projectData, updateProjectFiles } = useProject();

  const [token, setToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasAutoLoaded = useRef(false);

  const {
    repos,
    loading: loadingRepos,
    loadRepos,
    deleteRepo: deleteRepoHook,
    renameRepo: renameRepoHook,
    pullFromRepo,
    error: tokenError,
  } = useGitHubRepos(token);

  const [localRepos, setLocalRepos] = useState<GitHubRepo[]>([]);
  const [filterType, setFilterType] = useState<RepoFilterType>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const [renameName, setRenameName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pullProgress, setPullProgress] = useState("");

  // Token laden beim Mount
  useEffect(() => {
    const loadToken = async () => {
      try {
        setTokenLoading(true);
        const t = await getGitHubToken();
        setToken(t);
        console.log("[GitHubReposScreen] 🔑 Token geladen:", !!t);
      } catch (e: unknown) {
        console.error("[GitHubReposScreen] ❌ Token-Fehler:", e);
      } finally {
        setTokenLoading(false);
      }
    };

    loadToken();
  }, []);

  // Auto-Load Repos wenn Token verfügbar und noch nicht geladen
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
    setRenameName(deriveRenameDefault(activeRepo));
  }, [activeRepo]);

  // Pull-to-Refresh Handler
  const handleRefresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    await loadRepos();
    setRefreshing(false);
  }, [token, loadRepos]);

  const requireTokenOrAlert = useCallback(() => {
    if (!token) {
      Alert.alert(
        "Kein GitHub-Token",
        'Bitte hinterlege dein GitHub-PAT im „Verbindungen"-Screen und teste die Verbindung.',
      );
      return false;
    }
    return true;
  }, [token]);

  const handleSelectRepo = useCallback(
    (repo: GitHubRepo) => {
      setActiveRepo(repo.full_name);
      addRecentRepo(repo.full_name);
    },
    [setActiveRepo, addRecentRepo],
  );

  const handleDeleteRepo = useCallback(
    async (repo: GitHubRepo) => {
      if (!token) {
        Alert.alert(
          "Kein Token",
          "Bitte Token im Verbindungen-Screen hinterlegen.",
        );
        return;
      }

      Alert.alert(
        "Repo löschen?",
        `Soll das Repo „${repo.full_name}" wirklich gelöscht werden?\n\n⚠️ Diese Aktion kann nicht rückgängig gemacht werden!`,
        [
          { text: "Abbrechen", style: "cancel" },
          {
            text: "Löschen",
            style: "destructive",
            onPress: async () => {
              const success = await deleteRepoHook(repo);
              if (success) {
                if (activeRepo === repo.full_name) setActiveRepo(null);
                Alert.alert(
                  "✅ Gelöscht",
                  `Repository "${repo.name}" wurde gelöscht.`,
                );
              }
            },
          },
        ],
      );
    },
    [token, deleteRepoHook, activeRepo, setActiveRepo],
  );

  const handleCreateRepo = useCallback(async () => {
    const name = newRepoName.trim();

    // Validierung
    const validation = isValidRepoName(name);
    if (!validation.valid) {
      Alert.alert(
        "❌ Ungültiger Name",
        validation.error ?? "Bitte prüfe den Repo-Namen.",
      );
      return;
    }

    try {
      if (!requireTokenOrAlert()) return;

      setIsCreating(true);

      const repo = await createRepo(name, newRepoPrivate);
      setLocalRepos((prev) => [repo, ...prev]);
      setNewRepoName("");

      // Repos neu laden um Duplikate zu vermeiden
      await loadRepos();

      Alert.alert(
        "✅ Repo erstellt",
        `Repository "${repo.full_name || repo.name}" wurde angelegt.`,
      );
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : "Repository konnte nicht erstellt werden.";
      Alert.alert("❌ Fehler beim Erstellen", message);
    } finally {
      setIsCreating(false);
    }
  }, [newRepoName, newRepoPrivate, requireTokenOrAlert, loadRepos]);

  const handleRenameRepo = useCallback(async () => {
    if (!activeRepo) {
      Alert.alert("⚠️ Kein aktives Repo", "Bitte wähle zuerst ein Repo aus.");
      return;
    }

    const newName = renameName.trim();

    // Validierung
    const validation = isValidRepoName(newName);
    if (!validation.valid) {
      Alert.alert(
        "❌ Ungültiger Name",
        validation.error ?? "Bitte prüfe den Repo-Namen.",
      );
      return;
    }

    if (!token) {
      Alert.alert(
        "🔑 Kein Token",
        "Bitte Token im Verbindungen-Screen hinterlegen.",
      );
      return;
    }

    setIsRenaming(true);
    try {
      const newFullName = await renameRepoHook(activeRepo, newName);

      if (newFullName) {
        setActiveRepo(newFullName);
        addRecentRepo(newFullName);
        Alert.alert("✅ Umbenannt", `Repo heißt jetzt „${newFullName}".`);
      } else {
        Alert.alert(
          "❌ Fehler",
          "Umbenennung fehlgeschlagen. Bitte erneut versuchen.",
        );
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Umbenennung fehlgeschlagen.";
      Alert.alert("❌ Fehler beim Umbenennen", message);
    } finally {
      setIsRenaming(false);
    }
  }, [
    activeRepo,
    renameName,
    token,
    renameRepoHook,
    setActiveRepo,
    addRecentRepo,
  ]);

  const handlePushToRepo = useCallback(async () => {
    if (!activeRepo) {
      Alert.alert("Kein aktives Repo", "Bitte wähle zuerst ein Repo aus.");
      return;
    }

    if (!projectData?.files?.length) {
      Alert.alert(
        "Keine Dateien",
        "Im aktuellen Projekt sind keine Dateien zum Push vorhanden.",
      );
      return;
    }

    const parsed = splitFullName(activeRepo);
    if (!parsed) {
      Alert.alert(
        "Ungültiges Repo",
        `Aktives Repo hat ein unerwartetes Format: ${activeRepo}`,
      );
      return;
    }

    try {
      setIsPushing(true);
      await pushFilesToRepo(
        parsed.owner,
        parsed.repo,
        projectData.files as any,
      );
      Alert.alert(
        "✅ Push erfolgreich",
        `Projekt nach „${activeRepo}" übertragen.`,
      );
    } catch (e: any) {
      Alert.alert(
        "Fehler beim Push",
        e?.message ?? "Projekt konnte nicht nach GitHub gepusht werden.",
      );
    } finally {
      setIsPushing(false);
    }
  }, [activeRepo, projectData?.files]);

  const handlePullFromRepo = useCallback(async () => {
    if (!token) {
      Alert.alert(
        "Kein Token",
        "Bitte Token im Verbindungen-Screen hinterlegen.",
      );
      return;
    }
    if (!activeRepo) {
      Alert.alert("Kein aktives Repo", "Bitte wähle zuerst ein Repo aus.");
      return;
    }

    const parsed = splitFullName(activeRepo);
    if (!parsed) {
      Alert.alert(
        "Ungültiges Repo",
        `Aktives Repo hat ein unerwartetes Format: ${activeRepo}`,
      );
      return;
    }

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
      Alert.alert(
        "✅ Pull erfolgreich",
        `Es wurden ${files.length} Dateien aus „${activeRepo}" geladen.`,
      );
    }
  }, [token, activeRepo, pullFromRepo, updateProjectFiles]);

  const openGitHubActions = useCallback(() => {
    if (!activeRepo) {
      Alert.alert("Kein aktives Repo", "Bitte wähle zuerst ein Repo aus.");
      return;
    }

    const url = `https://github.com/${activeRepo}/actions`;
    Linking.openURL(url).catch(() => {
      Alert.alert(
        "Fehler",
        "GitHub Actions Seite konnte nicht geöffnet werden.",
      );
    });
  }, [activeRepo]);

  const allRepos = useMemo(
    () => combineRepos(repos, localRepos),
    [repos, localRepos],
  );

  const filteredRepos = useMemo(
    () =>
      filterRepos({
        repos: allRepos,
        searchTerm,
        filterType,
        activeRepo,
        recentRepos,
      }),
    [allRepos, searchTerm, filterType, activeRepo, recentRepos],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.palette.primary]}
            tintColor={theme.palette.primary}
            enabled={!!token}
          />
        }
      >
        <HeaderSection />

        <TokenStatusSection
          tokenLoading={tokenLoading}
          token={token}
          tokenError={tokenError}
          loadingRepos={loadingRepos}
          loadRepos={loadRepos}
        />

        <FilterSection
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterType={filterType}
          setFilterType={setFilterType}
          recentRepos={recentRepos}
          activeRepo={activeRepo}
          setActiveRepo={setActiveRepo}
          clearRecentRepos={clearRecentRepos}
        />

        <RepoListSection
          loadingRepos={loadingRepos}
          filteredRepos={filteredRepos}
          activeRepo={activeRepo}
          onSelectRepo={handleSelectRepo}
          onDeleteRepo={handleDeleteRepo}
        />

        <NewRepoSection
          newRepoName={newRepoName}
          setNewRepoName={setNewRepoName}
          newRepoPrivate={newRepoPrivate}
          setNewRepoPrivate={setNewRepoPrivate}
          isCreating={isCreating}
          onCreateRepo={handleCreateRepo}
        />

        <RenameRepoSection
          activeRepo={activeRepo}
          renameName={renameName}
          setRenameName={setRenameName}
          isRenaming={isRenaming}
          onRenameRepo={handleRenameRepo}
        />

        <ActionsSection
          activeRepo={activeRepo}
          isPushing={isPushing}
          onPush={handlePushToRepo}
          isPulling={isPulling}
          onPull={handlePullFromRepo}
          onOpenActions={openGitHubActions}
          pullProgress={pullProgress}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
