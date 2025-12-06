import React, { useEffect, useState, useMemo } from 'react';
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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import { useGitHub } from '../contexts/GitHubContext';
import { useProject, getGitHubToken } from '../contexts/ProjectContext';
import { pushFilesToRepo, createRepo } from '../contexts/githubService';

type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description?: string;
  updated_at: string;
  html_url: string;
};

type RepoFilterType = 'all' | 'activeOnly' | 'recentOnly';

const GitHubReposScreen: React.FC = () => {
  const { activeRepo, setActiveRepo, recentRepos, addRecentRepo, clearRecentRepos } =
    useGitHub();
  const { projectData } = useProject();

  const [token, setToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState<boolean>(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);
  const [errorRepos, setErrorRepos] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<RepoFilterType>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [pushing, setPushing] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);

  const projectName = projectData?.name ?? 'Unbenanntes Projekt';

  // Token laden
  useEffect(() => {
    let cancelled = false;
    const loadToken = async () => {
      try {
        setTokenLoading(true);
        const t = await getGitHubToken();
        if (cancelled) return;
        setToken(t);
      } catch (e: any) {
        if (!cancelled) {
          setTokenError(
            e?.message ?? 'GitHub-Token konnte nicht geladen werden.',
          );
        }
      } finally {
        if (!cancelled) {
          setTokenLoading(false);
        }
      }
    };

    loadToken();
    return () => {
      cancelled = true;
    };
  }, []);

  // Repos laden
  const loadRepos = async () => {
    if (!token) return;
    try {
      setLoadingRepos(true);
      setErrorRepos(null);
      const res = await fetch(
        'https://api.github.com/user/repos?per_page=100&sort=updated',
        {
          headers: {
            Authorization: `token ${token}`,
          },
        },
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `GitHub API Fehler (${res.status}): ${text.slice(0, 200)}`,
        );
      }

      const json = (await res.json()) as GitHubRepo[];
      if (Array.isArray(json)) {
        setRepos(json);
      } else {
        throw new Error('Antwort von GitHub ist kein Array.');
      }
    } catch (e: any) {
      console.log('[GitHubReposScreen] Repo-Load-Error:', e);
      setErrorRepos(
        e?.message ?? 'Repositories konnten nicht geladen werden.',
      );
    } finally {
      setLoadingRepos(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadRepos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filteredRepos = useMemo(() => {
    let base = repos;

    if (filterType === 'activeOnly' && activeRepo) {
      base = repos.filter((r) => r.full_name === activeRepo);
    } else if (filterType === 'recentOnly' && recentRepos.length > 0) {
      const set = new Set(recentRepos);
      base = repos.filter((r) => set.has(r.full_name));
    }

    if (!searchTerm.trim()) {
      return base;
    }

    const term = searchTerm.trim().toLowerCase();
    return base.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.full_name.toLowerCase().includes(term),
    );
  }, [repos, activeRepo, recentRepos, filterType, searchTerm]);

  const handleSelectRepo = async (repo: GitHubRepo) => {
    try {
      await setActiveRepo(repo.full_name);
      addRecentRepo(repo.full_name);
    } catch (e) {
      console.log('[GitHubReposScreen] Fehler beim Setzen des aktiven Repo:', e);
    }
  };

  const handleOpenRepo = (repo: GitHubRepo) => {
    if (!repo.html_url) return;
    Linking.openURL(repo.html_url).catch((e) => {
      console.log('[GitHubReposScreen] Fehler beim Öffnen des Repo-Links:', e);
      Alert.alert('Fehler', 'Repo-Link konnte nicht geöffnet werden.');
    });
  };

  const handleCreateRepo = async () => {
    if (!projectName) return;

    Alert.alert(
      'Neues Repo erstellen',
      `Für das aktuelle Projekt („${projectName}“) ein GitHub-Repo erstellen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Erstellen',
          style: 'default',
          onPress: async () => {
            try {
              setCreating(true);
              const repoName = projectName
                .toLowerCase()
                .replace(/[^a-z0-9-_]/g, '-')
                .slice(0, 60);

              const created: any = await createRepo(repoName, true);
              const fullName =
                created?.full_name ??
                `${created?.owner?.login}/${created?.name}`;

              if (fullName) {
                await setActiveRepo(fullName);
                addRecentRepo(fullName);
              }

              Alert.alert(
                'Repo erstellt',
                `Repository "${fullName || repoName}" wurde erstellt.`,
              );
              await loadRepos();
            } catch (e: any) {
              console.log('[GitHubReposScreen] Repo-Create-Error:', e);
              Alert.alert(
                'Fehler',
                e?.message ??
                  'GitHub-Repository konnte nicht erstellt werden.',
              );
            } finally {
              setCreating(false);
            }
          },
        },
      ],
    );
  };

  const handlePush = async (targetRepo?: string) => {
    const repoName = targetRepo || activeRepo;
    if (!repoName || !projectData?.files?.length) {
      Alert.alert(
        'Fehler',
        'Kein aktives Repo oder keine Projekt-Dateien vorhanden.',
      );
      return;
    }

    try {
      setPushing(true);
      const [owner, name] = repoName.split('/');
      await pushFilesToRepo(owner, name, projectData.files);
      Alert.alert(
        'Erfolg',
        `Dateien wurden nach "${repoName}" gepusht.`,
      );
    } catch (e: any) {
      console.log('[GitHubReposScreen] Push-Error:', e);
      Alert.alert('Push Fehler', e?.message ?? 'Push fehlgeschlagen.');
    } finally {
      setPushing(false);
    }
  };

  const renderRepoItem = ({ item }: { item: GitHubRepo }) => {
    const isActive = item.full_name === activeRepo;
    const isRecent = recentRepos.includes(item.full_name);

    return (
      <TouchableOpacity
        style={[styles.repoItem, isActive && styles.repoItemActive]}
        onPress={() => handleSelectRepo(item)}
      >
        <View style={styles.repoMain}>
          <Text style={styles.repoName}>{item.name}</Text>
          <Text style={styles.repoFullName}>{item.full_name}</Text>

          <View style={styles.repoMetaRow}>
            <Text style={styles.repoMetaText}>
              {item.private ? 'Privat' : 'Public'}
            </Text>
            <Text style={styles.repoMetaText}>
              Zuletzt: {new Date(item.updated_at).toLocaleDateString()}
            </Text>
            {isRecent && <Text style={styles.repoChip}>Zuletzt</Text>}
            {isActive && <Text style={styles.repoChipActive}>Aktiv</Text>}
          </View>
        </View>

        <View style={styles.repoActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => handleOpenRepo(item)}
          >
            <Ionicons
              name="open-outline"
              size={18}
              color={theme.palette.text.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => handlePush(item.full_name)}
          >
            {pushing && activeRepo === item.full_name ? (
              <ActivityIndicator size="small" color={theme.palette.primary} />
            ) : (
              <Ionicons
                name="cloud-upload-outline"
                size={18}
                color={theme.palette.primary}
              />
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>GitHub Repositories</Text>
          <Text style={styles.subtitle}>Projekt: {projectName}</Text>
        </View>
        <Ionicons
          name="logo-github"
          size={28}
          color={theme.palette.text.secondary}
        />
      </View>

      <View style={styles.tokenBox}>
        <Text style={styles.sectionTitle}>GitHub-Verbindung</Text>
        {tokenLoading && (
          <View style={styles.row}>
            <ActivityIndicator
              size="small"
              color={theme.palette.primary}
            />
            <Text style={styles.infoText}>Token wird geladen…</Text>
          </View>
        )}
        {!tokenLoading && token && (
          <Text style={styles.infoText}>✅ Token vorhanden</Text>
        )}
        {!tokenLoading && !token && (
          <Text style={styles.warningText}>
            ⚠️ Kein Token gefunden. Bitte im Screen „Verbindungen“ hinterlegen.
          </Text>
        )}
        {tokenError && (
          <Text style={styles.errorText}>
            Fehler: {tokenError}
          </Text>
        )}
      </View>

      <View style={styles.activeBox}>
        <View style={styles.activeHeader}>
          <Text style={styles.sectionTitle}>Aktives Repository</Text>
          {activeRepo && (
            <TouchableOpacity onPress={() => setActiveRepo(null)}>
              <Text style={styles.linkText}>Lösen</Text>
            </TouchableOpacity>
          )}
        </View>
        {activeRepo ? (
          <>
            <Text style={styles.activeRepoName}>{activeRepo}</Text>
            <View style={styles.activeActionsRow}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => handlePush()}
                disabled={pushing}
              >
                {pushing ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.palette.background}
                  />
                ) : (
                  <>
                    <Ionicons
                      name="cloud-upload-outline"
                      size={16}
                      color={theme.palette.background}
                    />
                    <Text style={styles.primaryButtonText}>Push</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View>
            <Text style={styles.infoText}>
              Kein aktives Repo ausgewählt. Wähle eines aus der Liste oder
              erstelle ein neues für dieses Projekt.
            </Text>
            <TouchableOpacity
              style={styles.outlineButton}
              onPress={handleCreateRepo}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator
                  size="small"
                  color={theme.palette.primary}
                />
              ) : (
                <>
                  <Ionicons
                    name="add-circle-outline"
                    size={16}
                    color={theme.palette.primary}
                  />
                  <Text style={styles.outlineButtonText}>
                    Repo für Projekt erstellen
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Filter / Search / Recent */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filterType === 'all' && styles.filterButtonActive,
          ]}
          onPress={() => setFilterType('all')}
        >
          <Text
            style={[
              styles.filterButtonText,
              filterType === 'all' && styles.filterButtonTextActive,
            ]}
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
            style={[
              styles.filterButtonText,
              filterType === 'activeOnly' && styles.filterButtonTextActive,
            ]}
          >
            Aktiv
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
            style={[
              styles.filterButtonText,
              filterType === 'recentOnly' && styles.filterButtonTextActive,
            ]}
          >
            Zuletzt
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.reloadButton} onPress={loadRepos}>
          <Text style={styles.reloadButtonText}>Neu laden</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Repos filtern…"
        placeholderTextColor={theme.palette.text.secondary}
        value={searchTerm}
        onChangeText={setSearchTerm}
      />

      {recentRepos.length > 0 && (
        <ScrollView
          style={styles.recentScroll}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {recentRepos.map((fullName) => (
            <TouchableOpacity
              key={fullName}
              style={styles.recentChip}
              onPress={() =>
                handleSelectRepo({
                  id: 0,
                  name: fullName.split('/').slice(-1)[0],
                  full_name: fullName,
                  private: true,
                  updated_at: new Date().toISOString(),
                  html_url: `https://github.com/${fullName}`,
                } as GitHubRepo)
              }
              onLongPress={() => clearRecentRepos()}
            >
              <Text style={styles.recentChipText}>{fullName}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {errorRepos && (
        <Text style={styles.errorText}>
          Fehler beim Laden der Repos: {errorRepos}
        </Text>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredRepos}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderRepoItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.contentContainer}
        ListEmptyComponent={
          !loadingRepos ? (
            <Text style={styles.emptyText}>
              Keine Repositories gefunden.
            </Text>
          ) : null
        }
      />

      {loadingRepos && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.palette.primary} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.palette.text.primary,
  },
  subtitle: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  tokenBox: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 4,
  },
  warningText: {
    fontSize: 12,
    color: theme.palette.warning,
    marginTop: 4,
  },
  errorText: {
    FontSize: 12,
    color: theme.palette.error,
    marginTop: 4,
  },
  linkText: {
    fontSize: 12,
    color: theme.palette.primary,
  },
  activeBox: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginBottom: 10,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  activeRepoName: {
    fontSize: 13,
    color: theme.palette.text.primary,
  },
  activeActionsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.palette.primary,
  },
  primaryButtonText: {
    marginLeft: 6,
    fontSize: 13,
    color: theme.palette.background,
    fontWeight: '600',
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.palette.primary,
    marginTop: 8,
  },
  outlineButtonText: {
    marginLeft: 6,
    fontSize: 13,
    color: theme.palette.primary,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    gap: 6,
  },
  filterButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  filterButtonActive: {
    backgroundColor: theme.palette.chip.background,
    borderColor: theme.palette.primary,
  },
  filterButtonText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  filterButtonTextActive: {
    fontSize: 12,
    color: theme.palette.text.primary,
    fontWeight: '600',
  },
  reloadButton: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  reloadButtonText: {
    fontSize: 12,
    color: theme.palette.text.primary,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: theme.palette.text.primary,
    fontSize: 13,
    marginBottom: 8,
  },
  recentScroll: {
    marginBottom: 8,
  },
  recentChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.palette.chip.background,
    borderWidth: 1,
    borderColor: theme.palette.chip.border,
    marginRight: 6,
  },
  recentChipText: {
    fontSize: 11,
    color: theme.palette.chip.text,
  },
  repoItem: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  repoItemActive: {
    backgroundColor: 'rgba(0,255,0,0.04)',
  },
  repoMain: {
    flex: 1,
    paddingRight: 8,
  },
  repoName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  repoFullName: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  repoMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  repoMetaText: {
    fontSize: 11,
    color: theme.palette.text.secondary,
  },
  repoChip: {
    fontSize: 11,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.chip.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  repoChipActive: {
    fontSize: 11,
    color: theme.palette.background,
    backgroundColor: theme.palette.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  repoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    padding: 6,
  },
  emptyText: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 13,
    color: theme.palette.text.secondary,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
});

export default GitHubReposScreen;
