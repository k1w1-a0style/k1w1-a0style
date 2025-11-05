// components/CustomHeader.tsx (V13 - REPARIERTES ERROR-HANDLING)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Linking, Platform, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, HEADER_HEIGHT } from '../theme';
import { DrawerHeaderProps } from '@react-navigation/drawer';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import { useProject, getGitHubToken, getExpoToken } from '../contexts/ProjectContext';
import { ensureSupabaseClient } from '../lib/supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GITHUB_REPO_KEY = 'github_repo_key';

let pollingInterval: NodeJS.Timeout | null = null;
const POLLING_INTERVAL_MS = 15000;

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  updated_at: string;
}

const CustomHeader: React.FC<DrawerHeaderProps> = ({ navigation, options }) => {
  const [isTriggeringBuild, setIsTriggeringBuild] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { projectData, exportProjectAsZip } = useProject();

  // States für Polling (Supabase)
  const [isPolling, setIsPolling] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<number | null>(null);
  const [buildStatus, setBuildStatus] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // States für Repo-Auswahl
  const [showRepoModal, setShowRepoModal] = useState(false);
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string>('');

  const supabaseRef = useRef<SupabaseClient | null>(null);
  const easTokenRef = useRef<string | null>(null);

  // Repo-Management
  const fetchGitHubRepos = async () => {
    try {
      const token = await getGitHubToken();
      if (!token) {
        Alert.alert('Fehler', 'GitHub Token nicht gefunden. Bitte in Verbindungen konfigurieren.');
        return;
      }
      setIsLoadingRepos(true);
      const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=50', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (!response.ok) {
        throw new Error(`GitHub API Error: ${response.status}`);
      }
      const repos = await response.json();
      setGithubRepos(repos);
    } catch (error: any) {
      Alert.alert('Repo-Fehler', error.message || 'Konnte Repos nicht laden');
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const selectRepo = async (repo: GitHubRepo) => {
    try {
      await AsyncStorage.setItem(GITHUB_REPO_KEY, repo.full_name);
      setSelectedRepo(repo.full_name);
      setShowRepoModal(false);
      Alert.alert('Repo ausgewählt', `Aktives Repo: ${repo.full_name}`);
    } catch (error) {
      Alert.alert('Fehler', 'Konnte Repo-Auswahl nicht speichern');
    }
  };

  useEffect(() => {
    const loadSelectedRepo = async () => {
      try {
        const repo = await AsyncStorage.getItem(GITHUB_REPO_KEY);
        if (repo) setSelectedRepo(repo);
      } catch (error) {
        console.error('Fehler beim Laden des ausgewählten Repos:', error);
      }
    };
    loadSelectedRepo();
  }, []);

  // Polling-Logik für Supabase
  const pollSupabaseBuild = useCallback(async () => {
    if (!currentJobId) {
      setIsPolling(false);
      return;
    }

    if (!supabaseRef.current) {
        try {
            supabaseRef.current = await ensureSupabaseClient();
        } catch (e) {
            setBuildStatus('Supabase-Fehler');
            setIsPolling(false);
            return;
        }
    }
    if (!easTokenRef.current) {
        const token = await getExpoToken();
        if (!token) {
            setBuildStatus('Expo Token fehlt');
            setIsPolling(false);
            return;
        }
        easTokenRef.current = token;
    }

    try {
      const { data, error } = await supabaseRef.current.functions.invoke('check-eas-build', {
        body: { jobId: currentJobId, easToken: easTokenRef.current }
      });
      if (error) throw error;

      console.log('Poll Status:', data.status);
      switch (data.status) {
        case 'pending': setBuildStatus('Job erstellt...'); break;
        case 'pushed': setBuildStatus('Code gepusht...'); break;
        case 'building': setBuildStatus('Build läuft...'); break;
        case 'success':
        case 'completed':
          setBuildStatus('Build erfolgreich!');
          setDownloadUrl(data.download_url || null);
          setIsPolling(false);
          setCurrentJobId(null);
          break;
        case 'error':
          setBuildStatus('Build fehlgeschlagen!');
          setIsPolling(false);
          setCurrentJobId(null);
          break;
      }
    } catch (pollError: any) {
      console.error('Polling-Fehler:', pollError);
      setBuildStatus('Polling-Fehler');
      setIsPolling(false);
      setCurrentJobId(null);
    }
  }, [currentJobId]);

  // useEffect für Supabase Polling
  useEffect(() => {
    if (isPolling && currentJobId) {
      console.log(`POLLING GESTARTET (Supabase) für Job ${currentJobId}`);
      pollSupabaseBuild(); // Sofort pollen
      pollingInterval = setInterval(pollSupabaseBuild, POLLING_INTERVAL_MS);
    } else if (!isPolling && pollingInterval) {
      console.log('POLLING GESTOPPT.');
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    };
  }, [isPolling, currentJobId, pollSupabaseBuild]);

  // ✅ REPARIERT: Direkter Fetch + besseres Error-Parsing
  const handleTriggerEasBuild = async () => {
    console.log("EAS Build Button gedrückt (Variante B - Supabase)");
    setIsTriggeringBuild(true);
    setBuildStatus('Code wird vorbereitet...');
    setDownloadUrl(null);

    try {
      if (!projectData || !projectData.files || projectData.files.length === 0) {
        throw new Error("Projekt ist leer. Es gibt keine Dateien zum Bauen.");
      }

      const easToken = await getExpoToken();
      const GITHUB_TOKEN = await getGitHubToken();
      const GITHUB_REPO = await AsyncStorage.getItem(GITHUB_REPO_KEY);
      const SUPABASE_KEY = await AsyncStorage.getItem('supabase_key');
      const SUPABASE_URL = await AsyncStorage.getItem('supabase_url');

      easTokenRef.current = easToken;
      if (!easToken || !GITHUB_REPO || !GITHUB_TOKEN || !SUPABASE_KEY || !SUPABASE_URL) {
        throw new Error("Credentials fehlen. Bitte 'Verbindungen' prüfen.");
      }

      console.log(`(Variante B) Pushe ${projectData.files.length} Dateien & triggere Build für ${GITHUB_REPO}...`);

      // ✅ DIREKTER FETCH (damit wir den Response-Body lesen können)
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/trigger-eas-build`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            githubRepo: GITHUB_REPO,
            githubToken: GITHUB_TOKEN,
            files: projectData.files
          })
        }
      );

      const responseData = await response.json();
      console.log('📥 Build Response:', responseData);

      // ✅ Prüfe auf Fehler
      if (!response.ok || responseData.success === false) {
        const errorMessage = responseData.error || 'Unbekannter Fehler';
        const errorStep = responseData.step || 'UNKNOWN';
        const errorHint = responseData.hint || '';

        // Benutzerfreundliche Fehlermeldung
        let displayMessage = `Build-Fehler (${errorStep}):\n\n${errorMessage}`;
        if (errorHint) {
          displayMessage += `\n\n💡 Tipp:\n${errorHint}`;
        }

        console.error('❌ Build Fehler:', { errorMessage, errorStep, errorHint });

        Alert.alert(
          '❌ Build fehlgeschlagen',
          displayMessage,
          [{ text: 'OK', style: 'default' }]
        );

        throw new Error(errorMessage);
      }

      // ✅ Erfolg
      console.log("✅ Build gestartet:", responseData);
      setCurrentJobId(responseData.job_id);
      setIsPolling(true);
      setBuildStatus('Code gepusht. Warte auf Build...');

    } catch (err: any) {
      console.error("Fehler in handleTriggerEasBuild:", err);
      setBuildStatus(null);
    } finally {
      setIsTriggeringBuild(false);
    }
  };

  const handleDownloadBuild = () => {
    if (downloadUrl) {
      Linking.openURL(downloadUrl);
    }
  };

  const handleExportZip = async () => {
    console.log("Export ZIP Button gedrückt");
    if (!projectData) return;
    setIsExporting(true);
    try {
      await exportProjectAsZip();
    } catch (e: any) {
      Alert.alert("Export Fehlgeschlagen", e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const getBuildStatusIcon = () => {
    if (isTriggeringBuild || isPolling) {
      return <ActivityIndicator size="small" color={theme.palette.warning} />;
    }
    if (downloadUrl) {
      return <Ionicons name="checkmark-circle" size={24} color={theme.palette.success} />;
    }
    if (buildStatus && buildStatus.includes('fehlgeschlagen')) {
      return <Ionicons name="close-circle" size={24} color={theme.palette.error} />;
    }
    return <Ionicons name="cloud-upload-outline" size={24} color={theme.palette.primary} />;
  };

  const onBuildIconPress = () => {
    if (isTriggeringBuild || isPolling) return;
    if (downloadUrl) {
      handleDownloadBuild();
    } else {
      handleTriggerEasBuild();
    }
  };

  const renderRepoItem = ({ item }: { item: GitHubRepo }) => (
    <TouchableOpacity
      style={[
        styles.repoItem,
        selectedRepo === item.full_name && styles.repoItemSelected
      ]}
      onPress={() => selectRepo(item)}
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
          <Ionicons name="checkmark-circle" size={16} color={theme.palette.success} />
        )}
      </View>
    </TouchableOpacity>
  );

  const headerTitle = String(projectData?.name || options?.title || 'k1w1-a0style');
  const isLoading = isTriggeringBuild || isPolling;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton} disabled={isLoading || isExporting}>
          <Ionicons name="menu-outline" size={30} color={theme.palette.text.primary} />
        </TouchableOpacity>

        {buildStatus ? (
          <Text style={[styles.title, styles.statusTitle]} numberOfLines={1}>
            {buildStatus}
          </Text>
        ) : (
          <Text style={styles.title} numberOfLines={1}>
            {headerTitle}
          </Text>
        )}

        <View style={styles.iconsContainer}>
          {/* BUILD BUTTON */}
          <TouchableOpacity onPress={onBuildIconPress} style={styles.iconButton} disabled={isExporting}>
            {getBuildStatusIcon()}
          </TouchableOpacity>

          {/* REPO SWITCHER */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              setShowRepoModal(true);
              fetchGitHubRepos();
            }}
            disabled={isLoading || isExporting}
          >
            <Ionicons name="git-branch-outline" size={22} color={theme.palette.primary} />
          </TouchableOpacity>

          {/* ZIP EXPORT */}
          <TouchableOpacity style={styles.iconButton} onPress={handleExportZip} disabled={isLoading || isExporting}>
            {isExporting ? <ActivityIndicator size="small" color={theme.palette.primary} /> : <Ionicons name="archive-outline" size={22} color={theme.palette.primary} />}
          </TouchableOpacity>
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
            <TouchableOpacity onPress={() => setShowRepoModal(false)}>
              <Ionicons name="close" size={24} color={theme.palette.text.primary} />
            </TouchableOpacity>
          </View>
          {selectedRepo ? (
            <View style={styles.selectedRepoInfo}>
              <Ionicons name="checkmark-circle" size={20} color={theme.palette.success} />
              <Text style={styles.selectedRepoText}>Aktuell: {selectedRepo}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.palette.card,
    paddingHorizontal: 15,
    height: HEADER_HEIGHT
  },
  title: {
    position: 'absolute',
    left: 60,
    right: 180,
    textAlign: 'center',
    color: theme.palette.text.primary,
    fontSize: 18,
    fontWeight: 'bold'
  },
  statusTitle: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    fontStyle: 'italic'
  },
  iconsContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  menuButton: { padding: 8 },
  iconButton: {
    marginLeft: 12,
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
  },
  selectedRepoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '500',
    color: theme.palette.success,
  },
  noRepoText: {
    padding: 16,
    textAlign: 'center',
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: theme.palette.text.secondary,
  },
  repoList: {
    flex: 1,
  },
  repoListContent: {
    padding: 16,
  },
  repoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    backgroundColor: theme.palette.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  repoItemSelected: {
    borderColor: theme.palette.success,
    backgroundColor: theme.palette.success + '10',
  },
  repoInfo: {
    flex: 1,
  },
  repoName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  repoFullName: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  repoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export default CustomHeader;
