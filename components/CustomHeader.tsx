// components/CustomHeader.tsx (Build: unified über ProjectContext)
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Modal,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, HEADER_HEIGHT } from "../theme";
import { DrawerHeaderProps } from "@react-navigation/drawer";
import { SafeAreaView } from "react-native-safe-area-context";
import { useProject, getGitHubToken } from "../contexts/ProjectContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ChatHeaderActions from "./ChatHeaderActions";

const GITHUB_REPO_KEY = "github_repo_key";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  updated_at: string;
}

const CustomHeader: React.FC<DrawerHeaderProps> = ({ navigation, options }) => {
  const { projectData, startBuild, currentBuild, setLinkedRepo } = useProject();

  // Repo selection
  const [showRepoModal, setShowRepoModal] = useState(false);
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string>("");

  const isBuilding =
    currentBuild?.status === "queued" || currentBuild?.status === "building";
  const buildUrl =
    currentBuild?.urls?.buildUrl ||
    currentBuild?.urls?.html ||
    currentBuild?.urls?.artifacts ||
    null;

  const buildHeaderText = useMemo(() => {
    if (!currentBuild) return null;
    if (!currentBuild.jobId && currentBuild.status === "idle") return null;
    return currentBuild.message || null;
  }, [currentBuild]);

  const isLoading = isLoadingRepos || isBuilding;

  const fetchGitHubRepos = async () => {
    try {
      const token = await getGitHubToken();
      if (!token) {
        Alert.alert(
          "Fehler",
          "GitHub Token nicht gefunden. Bitte in Verbindungen konfigurieren.",
        );
        return;
      }
      setIsLoadingRepos(true);

      const response = await fetch(
        "https://api.github.com/user/repos?sort=updated&per_page=50",
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        },
      );

      if (!response.ok) throw new Error(`GitHub API Error: ${response.status}`);

      const repos = await response.json();
      setGithubRepos(repos);
    } catch (error: any) {
      Alert.alert("Repo-Fehler", error?.message || "Konnte Repos nicht laden");
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const selectRepo = async (repo: GitHubRepo) => {
    try {
      await AsyncStorage.setItem(GITHUB_REPO_KEY, repo.full_name);
      setSelectedRepo(repo.full_name);
      try {
        await setLinkedRepo(repo.full_name, null);
      } catch (e) {
        // Best-effort: Repo bleibt zumindest im AsyncStorage gespeichert
        console.warn("⚠️ Konnte linkedRepo nicht setzen:", e);
      }
      setShowRepoModal(false);
      Alert.alert("Repo ausgewählt", `Aktives Repo: ${repo.full_name}`);
    } catch {
      Alert.alert("Fehler", "Konnte Repo-Auswahl nicht speichern");
    }
  };

  useEffect(() => {
    const loadSelectedRepo = async () => {
      try {
        const repo = await AsyncStorage.getItem(GITHUB_REPO_KEY);
        if (repo) {
          setSelectedRepo(repo);
          try {
            await setLinkedRepo(repo, null);
          } catch {
            // ignore
          }
        }
      } catch (error) {
        console.error("Fehler beim Laden des ausgewählten Repos:", error);
      }
    };
    loadSelectedRepo();
  }, [setLinkedRepo]);

  const getBuildStatusIcon = () => {
    if (isBuilding) {
      return <ActivityIndicator size="small" color={theme.palette.warning} />;
    }
    if (currentBuild?.status === "success") {
      return (
        <Ionicons
          name="checkmark-circle"
          size={24}
          color={theme.palette.success}
        />
      );
    }
    if (currentBuild?.status === "failed" || currentBuild?.status === "error") {
      return (
        <Ionicons name="close-circle" size={24} color={theme.palette.error} />
      );
    }
    return (
      <Ionicons
        name="cloud-upload-outline"
        size={24}
        color={theme.palette.primary}
      />
    );
  };

  const onBuildIconPress = async () => {
    if (isBuilding) return;

    if (currentBuild?.status === "success" && buildUrl) {
      try {
        await Linking.openURL(buildUrl);
      } catch {
        Alert.alert("Fehler", "Konnte Build-URL nicht öffnen.");
      }
      return;
    }

    if (!startBuild) {
      Alert.alert("Nicht verfügbar", "startBuild() ist nicht verfügbar.");
      return;
    }

    try {
      await startBuild("preview");
    } catch (e: any) {
      Alert.alert(
        "❌ Build fehlgeschlagen",
        e?.message || "Unbekannter Fehler",
      );
    }
  };

  const renderRepoItem = ({ item }: { item: GitHubRepo }) => (
    <TouchableOpacity
      style={[
        styles.repoItem,
        selectedRepo === item.full_name && styles.repoItemSelected,
      ]}
      onPress={() => selectRepo(item)}
      activeOpacity={0.85}
    >
      <View style={styles.repoInfo}>
        <Text style={styles.repoName}>{item.name}</Text>
        <Text style={styles.repoFullName}>{item.full_name}</Text>
      </View>

      <View style={styles.repoMeta}>
        <Ionicons
          name={item.private ? "lock-closed" : "globe-outline"}
          size={16}
          color={theme.palette.text.secondary}
        />
        {selectedRepo === item.full_name && (
          <Ionicons
            name="checkmark-circle"
            size={16}
            color={theme.palette.success}
          />
        )}
      </View>
    </TouchableOpacity>
  );

  const headerTitle = String(
    projectData?.name || options?.title || "k1w1-a0style",
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.openDrawer()}
          style={styles.menuButton}
          disabled={isLoading}
        >
          <Ionicons
            name="menu-outline"
            size={30}
            color={theme.palette.text.primary}
          />
        </TouchableOpacity>

        {buildHeaderText ? (
          <Text style={[styles.title, styles.statusTitle]} numberOfLines={1}>
            {buildHeaderText}
          </Text>
        ) : (
          <Text style={styles.title} numberOfLines={1}>
            {headerTitle}
          </Text>
        )}

        <View style={styles.iconsContainer}>
          {/* BUILD */}
          <TouchableOpacity
            onPress={onBuildIconPress}
            style={styles.iconButton}
            activeOpacity={0.85}
          >
            {getBuildStatusIcon()}
          </TouchableOpacity>

          {/* REPO SWITCHER (GitHub Logo, rund) */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              setShowRepoModal(true);
              fetchGitHubRepos();
            }}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            <Ionicons
              name="logo-github"
              size={22}
              color={theme.palette.primary}
            />
          </TouchableOpacity>

          {/* DROPDOWN: Chat/Projekt/ZIP (+ Rename) */}
          <ChatHeaderActions />
        </View>
      </View>

      {/* REPO MODAL */}
      <Modal
        visible={showRepoModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRepoModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>GitHub Repositories</Text>
            <TouchableOpacity
              onPress={() => setShowRepoModal(false)}
              activeOpacity={0.8}
            >
              <Ionicons
                name="close"
                size={24}
                color={theme.palette.text.primary}
              />
            </TouchableOpacity>
          </View>

          {selectedRepo ? (
            <View style={styles.selectedRepoInfo}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.palette.success}
              />
              <Text style={styles.selectedRepoText}>
                Aktuell: {selectedRepo}
              </Text>
            </View>
          ) : (
            <Text style={styles.noRepoText}>Kein Repo ausgewählt</Text>
          )}

          {isLoadingRepos ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={theme.palette.primary} />
              <Text style={styles.loadingText}>Lade Repositories...</Text>
            </View>
          ) : (
            <FlatList
              data={githubRepos}
              renderItem={renderRepoItem}
              keyExtractor={(item) => item.id.toString()}
              style={styles.repoList}
              contentContainerStyle={styles.repoListContent}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { backgroundColor: theme.palette.card },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.palette.card,
    paddingHorizontal: 15,
    height: HEADER_HEIGHT,
  },

  title: {
    position: "absolute",
    left: 60,
    right: 180,
    textAlign: "center",
    color: theme.palette.text.primary,
    fontSize: 18,
    fontWeight: "bold",
  },

  statusTitle: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    fontStyle: "italic",
  },

  iconsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },

  menuButton: { padding: 8 },

  iconButton: {
    marginLeft: 12,
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },

  modalContainer: { flex: 1, backgroundColor: theme.palette.background },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.palette.text.primary,
  },

  selectedRepoInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: theme.palette.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: theme.palette.success,
  },

  selectedRepoText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
    color: theme.palette.success,
  },

  noRepoText: {
    padding: 16,
    textAlign: "center",
    color: theme.palette.text.secondary,
    fontStyle: "italic",
  },

  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: theme.palette.text.secondary },

  repoList: { flex: 1 },
  repoListContent: { padding: 16 },

  repoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    marginBottom: 8,
    backgroundColor: theme.palette.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },

  repoItemSelected: {
    borderColor: theme.palette.success,
    backgroundColor: theme.palette.success + "10",
  },

  repoInfo: { flex: 1 },
  repoName: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.palette.text.primary,
  },
  repoFullName: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    marginTop: 2,
  },

  repoMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
});

export default CustomHeader;
