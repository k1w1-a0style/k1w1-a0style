/* eslint-disable react/no-unescaped-entities */
// screens/GitHubReposScreen.tsx - OPTIMIZED VERSION
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
  TextInput,
  ScrollView,
  Switch,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useGitHub } from '../contexts/GitHubContext';
import { useProject, getGitHubToken } from '../contexts/ProjectContext';
import { createRepo, pushFilesToRepo } from '../contexts/githubService';
import { useGitHubRepos, GitHubRepo } from '../hooks/useGitHubRepos';
import { RepoListItem } from '../components/RepoListItem';

type RepoFilterType = 'all' | 'activeOnly' | 'recentOnly';

export default function GitHubReposScreen() {
  const { activeRepo, setActiveRepo, recentRepos, addRecentRepo, clearRecentRepos } = useGitHub();
  const { projectData, updateProjectFiles } = useProject();

  const [token, setToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);

  const { repos, loading: loadingRepos, loadRepos, deleteRepo: deleteRepoHook, renameRepo: renameRepoHook, pullFromRepo, error: tokenError } = useGitHubRepos(token);
  const [localRepos, setLocalRepos] = useState<GitHubRepo[]>([]);

  const [filterType, setFilterType] = useState<RepoFilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // New repo
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Rename
  const [renameName, setRenameName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Pull / Push
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pullProgress, setPullProgress] = useState('');

  useEffect(() => {
    const loadToken = async () => {
      try {
        setTokenLoading(true);
        const t = await getGitHubToken();
        setToken(t);
        console.log('[GitHubReposScreen] Token loaded:', !!t);
      } catch (e: any) {
        // Silently handle token load errors
      } finally {
        setTokenLoading(false);
      }
    };

    loadToken();
  }, []);

  useEffect(() => {
    if (activeRepo) {
      const parts = activeRepo.split('/');
      setRenameName(parts[1] || activeRepo);
    } else {
      setRenameName('');
    }
  }, [activeRepo]);

  const requireTokenOrAlert = () => {
    if (!token) {
      Alert.alert(
        'Kein GitHub-Token',
        'Bitte hinterlege dein GitHub-PAT im „Verbindungen"-Screen und teste die Verbindung.'
      );
      return false;
    }
    return true;
  };

  const handleSelectRepo = useCallback(
    (repo: GitHubRepo) => {
      setActiveRepo(repo.full_name);
      addRecentRepo(repo.full_name);
    },
    [setActiveRepo, addRecentRepo]
  );

  const handleDeleteRepo = useCallback(
    async (repo: GitHubRepo) => {
      if (!token) {
        Alert.alert('Kein Token', 'Bitte Token im Verbindungen-Screen hinterlegen.');
        return;
      }

      Alert.alert(
        'Repo löschen?',
        `Soll das Repo „${repo.full_name}" wirklich gelöscht werden?\n\n⚠️ Diese Aktion kann nicht rückgängig gemacht werden!`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Löschen',
            style: 'destructive',
            onPress: async () => {
              const success = await deleteRepoHook(repo);
              if (success) {
                if (activeRepo === repo.full_name) {
                  setActiveRepo(null);
                }
                Alert.alert('✅ Gelöscht', `Repository "${repo.name}" wurde gelöscht.`);
              }
            },
          },
        ]
      );
    },
    [token, deleteRepoHook, activeRepo, setActiveRepo]
  );

  const handleCreateRepo = async () => {
    const name = newRepoName.trim();
    if (!name) {
      Alert.alert('Hinweis', 'Bitte einen Repo-Namen eingeben.');
      return;
    }

    try {
      if (!requireTokenOrAlert()) return;

      setIsCreating(true);

      const repo = await createRepo(name, newRepoPrivate);
      setLocalRepos((prev) => [repo, ...prev]);
      setNewRepoName('');
      // Reload repos to sync with backend
      loadRepos();

      Alert.alert('✅ Repo erstellt', `Repository "${repo.full_name}" wurde angelegt.`);
      } catch (e: any) {
        Alert.alert(
          'Fehler beim Erstellen',
          e?.message ?? 'Repository konnte nicht erstellt werden.'
        );
      } finally {
      setIsCreating(false);
    }
  };

  const handleRenameRepo = useCallback(async () => {
    if (!activeRepo) {
      Alert.alert('Kein aktives Repo', 'Bitte wähle zuerst ein Repo aus.');
      return;
    }
    const newName = renameName.trim();
    if (!newName) {
      Alert.alert('Hinweis', 'Bitte einen neuen Repo-Namen eingeben.');
      return;
    }

    if (!token) {
      Alert.alert('Kein Token', 'Bitte Token im Verbindungen-Screen hinterlegen.');
      return;
    }

    setIsRenaming(true);
    const newFullName = await renameRepoHook(activeRepo, newName);
    setIsRenaming(false);

    if (newFullName) {
      setActiveRepo(newFullName);
      addRecentRepo(newFullName);
      Alert.alert('✅ Umbenannt', `Repo heißt jetzt „${newFullName}".`);
    }
  }, [activeRepo, renameName, token, renameRepoHook, setActiveRepo, addRecentRepo]);

  const handlePushToRepo = async () => {
    if (!activeRepo) {
      Alert.alert('Kein aktives Repo', 'Bitte wähle zuerst ein Repo aus.');
      return;
    }
    if (!projectData?.files?.length) {
      Alert.alert(
        'Keine Dateien',
        'Im aktuellen Projekt sind keine Dateien zum Push vorhanden.'
      );
      return;
    }

    const [owner, repo] = activeRepo.split('/');
    if (!owner || !repo) {
      Alert.alert(
        'Ungültiges Repo',
        `Aktives Repo hat ein unerwartetes Format: ${activeRepo}`
      );
      return;
    }

    try {
      setIsPushing(true);
      await pushFilesToRepo(owner, repo, projectData.files as any);
      Alert.alert('✅ Push erfolgreich', `Projekt nach „${activeRepo}" übertragen.`);
    } catch (e: any) {
      Alert.alert(
        'Fehler beim Push',
        e?.message ?? 'Projekt konnte nicht nach GitHub gepusht werden.'
      );
    } finally {
      setIsPushing(false);
    }
  };

  const handlePullFromRepo = useCallback(async () => {
    if (!token) {
      Alert.alert('Kein Token', 'Bitte Token im Verbindungen-Screen hinterlegen.');
      return;
    }
    if (!activeRepo) {
      Alert.alert('Kein aktives Repo', 'Bitte wähle zuerst ein Repo aus.');
      return;
    }

    const [owner, repo] = activeRepo.split('/');
    if (!owner || !repo) {
      Alert.alert('Ungültiges Repo', `Aktives Repo hat ein unerwartetes Format: ${activeRepo}`);
      return;
    }

    setIsPulling(true);
    const files = await pullFromRepo(owner, repo, setPullProgress);
    setIsPulling(false);
    setPullProgress('');

    if (files && files.length > 0) {
      await updateProjectFiles(files as any, repo);
      Alert.alert('✅ Pull erfolgreich', `Es wurden ${files.length} Dateien aus „${activeRepo}" geladen.`);
    }
  }, [token, activeRepo, pullFromRepo, updateProjectFiles]);

  const openGitHubActions = () => {
    if (!activeRepo) {
      Alert.alert('Kein aktives Repo', 'Bitte wähle zuerst ein Repo aus.');
      return;
    }
    const url = `https://github.com/${activeRepo}/actions`;
    Linking.openURL(url).catch(() => {
      Alert.alert(
        'Fehler',
        'GitHub Actions Seite konnte nicht geöffnet werden.'
      );
    });
  };

  // Kombiniere geladene Repos mit lokalen (neu erstellten) Repos
  const allRepos = useMemo(() => {
    const combined = [...localRepos];
    repos.forEach((repo) => {
      if (!combined.find(r => r.id === repo.id)) {
        combined.push(repo);
      }
    });
    return combined;
  }, [repos, localRepos]);

  const filteredRepos = allRepos.filter((repo) => {
    const matchesSearch =
      !searchTerm ||
      repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'activeOnly') {
      return repo.full_name === activeRepo;
    }
    if (filterType === 'recentOnly') {
      return recentRepos.includes(repo.full_name);
    }

    return true;
  });

  const renderRepoItem = useCallback(
    ({ item }: { item: GitHubRepo }) => (
      <RepoListItem
        repo={item}
        isActive={item.full_name === activeRepo}
        onPress={handleSelectRepo}
        onDelete={handleDeleteRepo}
      />
    ),
    [activeRepo, handleSelectRepo, handleDeleteRepo]
  );

  const renderRecentRepos = () => {
    if (!recentRepos.length) {
      return (
        <Text style={styles.noRecentText}>
          Noch keine „zuletzt genutzten" Repos.
        </Text>
      );
    }

    return (
      <View style={styles.recentContainer}>
        {recentRepos.map((r) => (
          <TouchableOpacity
            key={r}
            style={[
              styles.recentPill,
              r === activeRepo && styles.recentPillActive,
            ]}
            onPress={() => setActiveRepo(r)}
          >
            <Text style={styles.recentPillText}>{r}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={clearRecentRepos}>
          <Text style={styles.clearRecentText}>Verlauf löschen</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerSection}>
          <Ionicons name="logo-github" size={32} color={theme.palette.primary} />
          <View style={styles.headerText}>
            <Text style={styles.title}>GitHub Repositories</Text>
            <Text style={styles.subtitle}>
              Verwalte deine Repos, verknüpfe sie mit dem Projekt und nutze Push/Pull für den Builder-Flow.
            </Text>
          </View>
        </View>

      {/* Token-Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>GitHub Token</Text>
        {tokenLoading ? (
          <View style={styles.tokenLoader}>
            <ActivityIndicator
              size="small"
              color={theme.palette.primary}
            />
          </View>
        ) : (
          <>
            <Text style={styles.tokenText}>
              {token
                ? '✅ Token vorhanden (siehe Verbindungen-Screen)'
                : '⚠️ Kein Token gesetzt. Bitte in „Verbindungen" speichern.'}
            </Text>
            {tokenError && (
              <Text style={styles.errorText}>{tokenError}</Text>
            )}
          </>
        )}

        <TouchableOpacity
          style={[styles.button, loadingRepos && styles.buttonDisabled]}
          onPress={loadRepos}
          disabled={loadingRepos}
        >
          {loadingRepos ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.buttonText}>Repos laden</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Filter / Suche */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Filter</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Repos filtern..."
            placeholderTextColor={theme.palette.text.secondary}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterType === 'all' && styles.filterButtonActive,
            ]}
            onPress={() => setFilterType('all')}
          >
            <Text
              style={
                filterType === 'all'
                  ? styles.filterButtonTextActive
                  : styles.filterButtonText
              }
            >
              Alle
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterType === 'activeOnly' && styles.filterButtonActive,
            ]}
            onPress={() => setFilterType('activeOnly')}
          >
            <Text
              style={
                filterType === 'activeOnly'
                  ? styles.filterButtonTextActive
                  : styles.filterButtonText
              }
            >
              Aktives Repo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterType === 'recentOnly' && styles.filterButtonActive,
            ]}
            onPress={() => setFilterType('recentOnly')}
          >
            <Text
              style={
                filterType === 'recentOnly'
                  ? styles.filterButtonTextActive
                  : styles.filterButtonText
              }
            >
              Zuletzt genutzt
            </Text>
          </TouchableOpacity>
        </View>
        {renderRecentRepos()}
      </View>

      {/* Repo-Liste */}
      <View style={styles.section}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Repositories</Text>
          {loadingRepos && (
            <ActivityIndicator
              size="small"
              color={theme.palette.primary}
            />
          )}
        </View>
        <FlatList
          data={filteredRepos}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRepoItem}
          scrollEnabled={false}
        />
      </View>

      {/* Neues Repo / Rename */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Neues Repo</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Repo-Name"
          placeholderTextColor={theme.palette.text.secondary}
          value={newRepoName}
          onChangeText={setNewRepoName}
        />
        <View style={styles.rowBetween}>
          <Text style={styles.smallLabel}>Privat</Text>
          <Switch
            value={newRepoPrivate}
            onValueChange={setNewRepoPrivate}
          />
        </View>
        <TouchableOpacity style={styles.button} onPress={handleCreateRepo}>
          {isCreating ? (
            <ActivityIndicator
              size="small"
              color={theme.palette.primary}
            />
          ) : (
            <Text style={styles.buttonText}>Repo erstellen</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Repo umbenennen</Text>
        <Text style={styles.currentRepoText}>
          Aktives Repo:{' '}
          {activeRepo ? activeRepo : '– keins ausgewählt –'}
        </Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Neuer Repo-Name"
          placeholderTextColor={theme.palette.text.secondary}
          value={renameName}
          onChangeText={setRenameName}
        />
        <TouchableOpacity style={styles.button} onPress={handleRenameRepo}>
          {isRenaming ? (
            <ActivityIndicator
              size="small"
              color={theme.palette.primary}
            />
          ) : (
            <Text style={styles.buttonText}>Umbenennen</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aktionen für aktives Repo</Text>
        <Text style={styles.actionsLabel}>
          Aktives Repo: {activeRepo || '– keins –'}
        </Text>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handlePushToRepo}
            disabled={isPushing}
          >
            {isPushing ? (
              <ActivityIndicator
                size="small"
                color={theme.palette.primary}
              />
            ) : (
              <Text style={styles.actionButtonText}>Push</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handlePullFromRepo}
            disabled={isPulling}
          >
            {isPulling ? (
              <ActivityIndicator
                size="small"
                color={theme.palette.primary}
              />
            ) : (
              <Text style={styles.actionButtonText}>Pull</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={openGitHubActions}
          >
            <Text style={styles.actionButtonText}>Actions</Text>
          </TouchableOpacity>
        </View>

        {!!pullProgress && (
          <Text style={styles.progressText}>{pullProgress}</Text>
        )}
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
    padding: 12,
    borderRadius: 8,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginBottom: 8,
  },
  tokenLoader: { marginBottom: 8 },
  tokenText: { fontSize: 12, color: theme.palette.text.secondary },
  errorText: { color: theme.palette.error, fontSize: 12, marginBottom: 8 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    backgroundColor: theme.palette.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  searchRow: { flexDirection: 'row', marginBottom: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: theme.palette.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: theme.palette.text.primary,
    fontSize: 13,
  },
  filterRow: { flexDirection: 'row', marginBottom: 8 },
  filterButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primary,
  },
  filterButtonText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  filterButtonTextActive: {
    fontSize: 12,
    color: '#000',
    fontWeight: '600',
  },
  noRecentText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  recentContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6 as any,
    marginTop: 8,
  },
  recentPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginRight: 4,
    marginBottom: 4,
  },
  recentPillActive: {
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primary,
  },
  recentPillText: {
    fontSize: 11,
    color: theme.palette.text.primary,
  },
  clearRecentText: {
    fontSize: 11,
    color: theme.palette.text.secondary,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  smallLabel: {
    fontSize: 13,
    color: theme.palette.text.secondary,
  },
  currentRepoText: {
    fontSize: 13,
    color: theme.palette.text.primary,
    marginBottom: 8,
  },
  actionsLabel: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginTop: 8,
    marginBottom: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8 as any,
  },
  actionButton: {
    backgroundColor: theme.palette.secondary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  actionButtonText: {
    fontSize: 12,
    color: theme.palette.text.primary,
    textAlign: 'center',
  },
  progressText: {
    fontSize: 10,
    color: theme.palette.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
});
