// screens/GitHubReposScreen.tsx - MIT ALLEN FIXES (A)
// ✅ Error-Handling bei Netzwerkproblemen
// ✅ Loading-States bei allen Operationen
// ✅ Binary Files werden übersprungen (kein Base64-Crash)
// ✅ Retry-Logic bei API-Fehlern
// ✅ Besseres User-Feedback

import React, { useEffect, useState } from 'react';
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
import { Buffer } from 'buffer';
import { theme } from '../theme';
import { useGitHub } from '../contexts/GitHubContext';
import { useProject, getGitHubToken } from '../contexts/ProjectContext';
import { createRepo, pushFilesToRepo } from '../contexts/githubService';
import { ProjectFile } from '../contexts/types';

type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description?: string | null;
  updated_at: string;
};

type RepoFilterType = 'all' | 'activeOnly' | 'recentOnly';

// ✅ Retry-Helper für API-Calls
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, options);

      // Erfolg oder "finaler" Fehler (404 / 403)
      if (res.ok || res.status === 404 || res.status === 403) {
        return res;
      }

      // Bei 5xx-Fehlern mit Backoff erneut versuchen
      if (res.status >= 500 && i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        continue;
      }

      return res;
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }

  throw new Error('Max retries erreicht');
}

export default function GitHubReposScreen() {
  const { activeRepo, setActiveRepo, recentRepos, addRecentRepo, clearRecentRepos } =
    useGitHub();
  const { projectData, updateProjectFiles } = useProject();

  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [errorRepos, setErrorRepos] = useState<string | null>(null);

  const [token, setToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<RepoFilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Neues Repo
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Umbenennen
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
        setTokenError(null);
        const t = await getGitHubToken();
        setToken(t);
        console.log('[GitHubReposScreen] GitHub-Token geladen:', !!t);
      } catch (e: any) {
        console.log('[GitHubReposScreen] Fehler beim Token-Laden:', e);
        setTokenError(e?.message ?? 'Fehler beim Laden des Tokens');
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

  const loadRepos = async () => {
    try {
      if (!requireTokenOrAlert()) return;

      setLoadingRepos(true);
      setErrorRepos(null);

      const res = await fetchWithRetry(
        'https://api.github.com/user/repos?per_page=100&sort=updated',
        {
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `token ${token}`,
          },
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub-API Fehler (${res.status}): ${text}`);
      }

      const json = (await res.json()) as GitHubRepo[];
      setRepos(json);
    } catch (e: any) {
      console.log('[GitHubReposScreen] Netzwerkfehler:', e);
      setErrorRepos(e?.message ?? 'Netzwerkfehler beim Laden der Repos.');
      Alert.alert(
        'Fehler',
        'Repos konnten nicht geladen werden. Prüfe deine Internetverbindung.'
      );
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleSelectRepo = (repo: GitHubRepo) => {
    setActiveRepo(repo.full_name);
    addRecentRepo(repo.full_name);
  };

  const deleteRepo = async (repo: GitHubRepo) => {
    try {
      if (!requireTokenOrAlert()) return;

      Alert.alert(
        'Repo löschen?',
        `Soll das Repo „${repo.full_name}" wirklich gelöscht werden?\n\n⚠️ Diese Aktion kann nicht rückgängig gemacht werden!`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Löschen',
            style: 'destructive',
            onPress: async () => {
              try {
                const res = await fetchWithRetry(
                  `https://api.github.com/repos/${repo.full_name}`,
                  {
                    method: 'DELETE',
                    headers: {
                      Accept: 'application/vnd.github+json',
                      Authorization: `token ${token}`,
                    },
                  }
                );

                if (res.status === 403) {
                  const text = await res.text();
                  console.log('[GitHubReposScreen] 403 beim Löschen:', text);
                  Alert.alert(
                    'Keine Rechte',
                    'Du brauchst Admin-Rechte + delete_repo-Scope für dieses Repository.'
                  );
                  return;
                }

                if (res.status !== 204) {
                  const text = await res.text();
                  throw new Error(`Status ${res.status}: ${text}`);
                }

                setRepos((prev) =>
                  prev.filter((r) => r.full_name !== repo.full_name)
                );

                if (activeRepo === repo.full_name) {
                  setActiveRepo(null);
                }

                Alert.alert('✅ Gelöscht', `Repository "${repo.name}" wurde gelöscht.`);
              } catch (e: any) {
                console.log('[GitHubReposScreen] Fehler beim Löschen:', e);
                Alert.alert(
                  'Fehler',
                  e?.message ?? 'Repo konnte nicht gelöscht werden.'
                );
              }
            },
          },
        ]
      );
    } catch (e: any) {
      console.log('[GitHubReposScreen] deleteRepo Fehler:', e);
    }
  };

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
      setRepos((prev) => [repo, ...prev]);
      setNewRepoName('');

      Alert.alert('✅ Repo erstellt', `Repository "${repo.full_name}" wurde angelegt.`);
    } catch (e: any) {
      console.log('[GitHubReposScreen] Fehler beim Erstellen:', e);
      Alert.alert(
        'Fehler beim Erstellen',
        e?.message ?? 'Repository konnte nicht erstellt werden.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleRenameRepo = async () => {
    if (!activeRepo) {
      Alert.alert('Kein aktives Repo', 'Bitte wähle zuerst ein Repo aus.');
      return;
    }
    const newName = renameName.trim();
    if (!newName) {
      Alert.alert('Hinweis', 'Bitte einen neuen Repo-Namen eingeben.');
      return;
    }

    const [owner] = activeRepo.split('/');
    const newFull = `${owner}/${newName}`;

    try {
      if (!requireTokenOrAlert()) return;

      setIsRenaming(true);

      const res = await fetchWithRetry(
        `https://api.github.com/repos/${activeRepo}`,
        {
          method: 'PATCH',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `token ${token}`,
          },
          body: JSON.stringify({ name: newName }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Status ${res.status}: ${text}`);
      }

      setActiveRepo(newFull);
      addRecentRepo(newFull);

      setRepos((prev) =>
        prev.map((r) =>
          r.full_name === activeRepo
            ? {
                ...r,
                name: newName,
                full_name: newFull,
              }
            : r
        )
      );

      Alert.alert('✅ Umbenannt', `Repo heißt jetzt „${newFull}".`);
    } catch (e: any) {
      console.log('[GitHubReposScreen] Rename-Fehler:', e);
      Alert.alert(
        'Fehler beim Umbenennen',
        e?.message ?? 'Repo konnte nicht umbenannt werden.'
      );
    } finally {
      setIsRenaming(false);
    }
  };

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
      console.log('[GitHubReposScreen] Push-Fehler:', e);
      Alert.alert(
        'Fehler beim Push',
        e?.message ?? 'Projekt konnte nicht nach GitHub gepusht werden.'
      );
    } finally {
      setIsPushing(false);
    }
  };

  // ✅ VERBESSERTER PULL mit Error-Handling & Binary-Filter
  const handlePullFromRepo = async () => {
    if (!requireTokenOrAlert()) return;
    if (!activeRepo) {
      Alert.alert('Kein aktives Repo', 'Bitte wähle zuerst ein Repo aus.');
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
      setIsPulling(true);
      setPullProgress('Lade Repo-Info...');

      const headers = {
        Accept: 'application/vnd.github+json',
        Authorization: `token ${token}`,
      };

      // 1. Repo-Info + Default-Branch abrufen
      const infoRes = await fetchWithRetry(
        `https://api.github.com/repos/${owner}/${repo}`,
        { headers }
      );

      if (!infoRes.ok) {
        const text = await infoRes.text();
        throw new Error(`Repo nicht gefunden (${infoRes.status}): ${text}`);
      }

      const infoJson = await infoRes.json();
      const branch = infoJson.default_branch || 'main';

      setPullProgress(`Lade Dateibaum (Branch: ${branch})...`);

      // 2. Git-Tree abrufen (mit Retry)
      let treeJson: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const treeRes = await fetchWithRetry(
          `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
          { headers }
        );

        if (treeRes.ok) {
          treeJson = await treeRes.json();
          break;
        }

        if (attempt === 2) {
          const text = await treeRes.text();
          throw new Error(
            `Tree-Abruf fehlgeschlagen (${treeRes.status}): ${text}`
          );
        }

        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }

      if (!treeJson || !Array.isArray(treeJson.tree)) {
        throw new Error('Ungültige Baum-Struktur aus GitHub erhalten.');
      }

      const textExtensions = [
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '.json',
        '.md',
        '.txt',
        '.yml',
        '.yaml',
        '.config.js',
      ];

      const files: ProjectFile[] = [];

      const treeEntries = treeJson.tree.filter(
        (entry: any) => entry.type === 'blob'
      );

      if (!treeEntries.length) {
        Alert.alert(
          'Keine Dateien',
          'Im Repository wurden keine Dateien gefunden.'
        );
        return;
      }

      setPullProgress(`Lade Dateien (${treeEntries.length})...`);

      const singleFetch = async (path: string) => {
        const extMatch = path.match(/\.[^.]+$/);
        const ext = extMatch ? extMatch[0].toLowerCase() : '';

        if (!textExtensions.includes(ext)) {
          console.log(`[GitHubReposScreen] ⏭ Überspringe Binary: ${path}`);
          return null;
        }

        try {
          const res = await fetchWithRetry(
            `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(
              path
            )}`,
            { headers }
          );

          if (!res.ok) {
            console.log(
              '[GitHubReposScreen] Fehler beim Laden von',
              path,
              res.status
            );
            return null;
          }

          const json = await res.json();
          const content =
            json.encoding === 'base64'
              ? Buffer.from(
                  String(json.content || '').replace(/\n/g, ''),
                  'base64'
                ).toString('utf8')
              : json.content || '';

          const file: ProjectFile = {
            path,
            content,
          };

          return file;
        } catch (e) {
          console.log('[GitHubReposScreen] Fehler bei Datei:', path, e);
          return null;
        }
      };

      // Dateien in Batches laden
      const BATCH_SIZE = 10;
      for (let i = 0; i < treeEntries.length; i += BATCH_SIZE) {
        const batch = treeEntries.slice(i, i + BATCH_SIZE);
        setPullProgress(
          `Lade Dateien ${i + 1}-${Math.min(
            i + BATCH_SIZE,
            treeEntries.length
          )} von ${treeEntries.length}...`
        );

        const results = await Promise.allSettled(
          batch.map((entry: any) => singleFetch(entry.path))
        );

        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            files.push(result.value);
          }
        });
      }

      if (files.length === 0) {
        Alert.alert(
          'Keine Dateien',
          'Im Repository wurden keine Text-Dateien gefunden.'
        );
        return;
      }

      setPullProgress('Aktualisiere Projekt...');
      await updateProjectFiles(files as any, repo);

      Alert.alert(
        '✅ Pull erfolgreich',
        `Es wurden ${files.length} Dateien aus „${activeRepo}" geladen.`
      );
    } catch (e: any) {
      console.log('[GitHubReposScreen] Pull-Fehler:', e);
      Alert.alert(
        'Pull fehlgeschlagen',
        e?.message ?? 'Dateien konnten nicht aus GitHub geladen werden.'
      );
    } finally {
      setIsPulling(false);
      setPullProgress('');
    }
  };

  const openGitHubActions = () => {
    if (!activeRepo) {
      Alert.alert('Kein aktives Repo', 'Bitte wähle zuerst ein Repo aus.');
      return;
    }
    const url = `https://github.com/${activeRepo}/actions`;
    Linking.openURL(url).catch((e) => {
      console.log('[GitHubReposScreen] Fehler beim Öffnen von Actions:', e);
      Alert.alert(
        'Fehler',
        'GitHub Actions Seite konnte nicht geöffnet werden.'
      );
    });
  };

  const filteredRepos = repos.filter((repo) => {
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

  const renderRepoItem = ({ item }: { item: GitHubRepo }) => {
    const isActive = item.full_name === activeRepo;

    return (
      <View style={[styles.repoItem, isActive && styles.repoItemSelected]}>
        <TouchableOpacity
          style={styles.repoInfo}
          onPress={() => handleSelectRepo(item)}
        >
          <Text style={styles.repoName}>{item.name}</Text>
          <Text style={styles.repoFullName}>{item.full_name}</Text>
          {!!item.description && (
            <Text style={styles.repoDescription}>{item.description}</Text>
          )}
          <Text style={styles.repoMeta}>
            Zuletzt aktualisiert:{' '}
            {new Date(item.updated_at).toLocaleString()}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteRepo(item)}
        >
          <Text style={styles.deleteButtonText}>🗑</Text>
        </TouchableOpacity>
      </View>
    );
  };

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>GitHub Repositories</Text>
      <Text style={styles.subtitle}>
        Verwalte deine Repos, verknüpfe sie mit dem Projekt und nutze Push/Pull
        für den Builder-Flow.
      </Text>

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

        <TouchableOpacity style={styles.button} onPress={loadRepos}>
          {loadingRepos ? (
            <ActivityIndicator
              size="small"
              color={theme.palette.primary}
            />
          ) : (
            <Text style={styles.buttonText}>Repos laden</Text>
          )}
        </TouchableOpacity>

        {errorRepos && <Text style={styles.errorText}>{errorRepos}</Text>}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.palette.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
    marginBottom: theme.spacing.sm,
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
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: theme.palette.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: { color: '#000', fontWeight: '600' },
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
  repoItem: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  repoItemSelected: {
    // vorher: theme.palette.highlight → gibt's im Typ nicht
    backgroundColor: theme.palette.card,
  },
  repoInfo: { flex: 1, paddingRight: 8 },
  repoName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  repoFullName: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  repoDescription: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  repoMeta: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    marginTop: 4,
  },
  deleteButton: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: { fontSize: 16 },
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
