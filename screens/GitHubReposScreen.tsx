// screens/GitHubReposScreen.tsx
// Erweiterter GitHub Repositories Screen
// ✅ Repository-Auswahl und -Verwaltung
// ✅ Actions Status-Anzeige für aktives Repo
// ✅ Branch-Informationen
// ✅ Workflow-Übersicht
// ✅ Quick-Push und Repo-Erstellung

import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';

import { theme } from '../theme';
import { useGitHub } from '../contexts/GitHubContext';
import { useProject, getGitHubToken } from '../contexts/ProjectContext';
import { pushFilesToRepo, createRepo, getWorkflowRuns } from '../contexts/githubService';
import {
  GitHubRepo,
  GitHubWorkflowRun,
  GitHubBranch,
  GitHubWorkflow,
} from '../contexts/types';

type RepoFilterType = 'all' | 'activeOnly' | 'recentOnly';
type ViewMode = 'repos' | 'actions' | 'branches';

const AnimatedView = Animated.View;

const GitHubReposScreen: React.FC = () => {
  const { activeRepo, setActiveRepo, recentRepos, addRecentRepo, clearRecentRepos } =
    useGitHub();
  const { projectData } = useProject();

  // Token State
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState<boolean>(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Repos State
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);
  const [errorRepos, setErrorRepos] = useState<string | null>(null);

  // Actions State
  const [workflowRuns, setWorkflowRuns] = useState<GitHubWorkflowRun[]>([]);
  const [loadingActions, setLoadingActions] = useState<boolean>(false);
  const [workflows, setWorkflows] = useState<GitHubWorkflow[]>([]);

  // Branches State
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState<boolean>(false);
  const [defaultBranch, setDefaultBranch] = useState<string>('main');

  // UI State
  const [filterType, setFilterType] = useState<RepoFilterType>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [pushing, setPushing] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('repos');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRepoId, setExpandedRepoId] = useState<number | null>(null);

  const projectName = projectData?.name ?? 'Unbenanntes Projekt';

  // ===========================================
  // Token laden
  // ===========================================
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
          setTokenError(e?.message ?? 'GitHub-Token konnte nicht geladen werden.');
        }
      } finally {
        if (!cancelled) {
          setTokenLoading(false);
        }
      }
    };

    loadToken();
    return () => { cancelled = true; };
  }, []);

  // ===========================================
  // Repos laden
  // ===========================================
  const loadRepos = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingRepos(true);
      setErrorRepos(null);
      const res = await fetch(
        'https://api.github.com/user/repos?per_page=100&sort=updated',
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github+json',
          },
        },
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub API Fehler (${res.status}): ${text.slice(0, 200)}`);
      }

      const json = await res.json();
      if (Array.isArray(json)) {
        setRepos(json);
      } else {
        throw new Error('Antwort von GitHub ist kein Array.');
      }
    } catch (e: any) {
      console.log('[GitHubReposScreen] Repo-Load-Error:', e);
      setErrorRepos(e?.message ?? 'Repositories konnten nicht geladen werden.');
    } finally {
      setLoadingRepos(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadRepos();
    }
  }, [token, loadRepos]);

  // ===========================================
  // Workflow Runs für aktives Repo laden
  // ===========================================
  const loadWorkflowRuns = useCallback(async () => {
    if (!activeRepo || !token) return;

    try {
      setLoadingActions(true);
      const [owner, repo] = activeRepo.split('/');

      // Workflow Runs laden
      const runsRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=10`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github+json',
          },
        },
      );

      if (runsRes.ok) {
        const runsJson = await runsRes.json();
        setWorkflowRuns(runsJson.workflow_runs || []);
      }

      // Workflows laden
      const workflowsRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github+json',
          },
        },
      );

      if (workflowsRes.ok) {
        const workflowsJson = await workflowsRes.json();
        setWorkflows(workflowsJson.workflows || []);
      }
    } catch (e) {
      console.log('[GitHubReposScreen] Actions-Load-Error:', e);
    } finally {
      setLoadingActions(false);
    }
  }, [activeRepo, token]);

  // ===========================================
  // Branches für aktives Repo laden
  // ===========================================
  const loadBranches = useCallback(async () => {
    if (!activeRepo || !token) return;

    try {
      setLoadingBranches(true);
      const [owner, repo] = activeRepo.split('/');

      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/branches?per_page=30`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github+json',
          },
        },
      );

      if (res.ok) {
        const json = await res.json();
        setBranches(json || []);
      }

      // Default Branch ermitteln
      const repoRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github+json',
          },
        },
      );

      if (repoRes.ok) {
        const repoJson = await repoRes.json();
        setDefaultBranch(repoJson.default_branch || 'main');
      }
    } catch (e) {
      console.log('[GitHubReposScreen] Branches-Load-Error:', e);
    } finally {
      setLoadingBranches(false);
    }
  }, [activeRepo, token]);

  // Daten bei Repo-Wechsel laden
  useEffect(() => {
    if (activeRepo) {
      loadWorkflowRuns();
      loadBranches();
    } else {
      setWorkflowRuns([]);
      setBranches([]);
      setWorkflows([]);
    }
  }, [activeRepo, loadWorkflowRuns, loadBranches]);

  // ===========================================
  // Refresh Handler
  // ===========================================
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadRepos(),
      activeRepo ? loadWorkflowRuns() : Promise.resolve(),
      activeRepo ? loadBranches() : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [loadRepos, loadWorkflowRuns, loadBranches, activeRepo]);

  // ===========================================
  // Filtered Repos
  // ===========================================
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

  // ===========================================
  // Handlers
  // ===========================================
  const handleSelectRepo = async (repo: GitHubRepo) => {
    try {
      await setActiveRepo(repo.full_name);
      addRecentRepo(repo.full_name);
      setViewMode('repos');
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

  const handleOpenUrl = (url: string) => {
    Linking.openURL(url).catch((e) => {
      Alert.alert('Fehler', 'Link konnte nicht geöffnet werden.');
    });
  };

  const handleCreateRepo = async () => {
    if (!projectName) return;

    Alert.alert(
      'Neues Repo erstellen',
      `Für das aktuelle Projekt („${projectName}") ein GitHub-Repo erstellen?`,
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
                e?.message ?? 'GitHub-Repository konnte nicht erstellt werden.',
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
      Alert.alert('Erfolg', `Dateien wurden nach "${repoName}" gepusht.`);
    } catch (e: any) {
      console.log('[GitHubReposScreen] Push-Error:', e);
      Alert.alert('Push Fehler', e?.message ?? 'Push fehlgeschlagen.');
    } finally {
      setPushing(false);
    }
  };

  // ===========================================
  // Status Helpers
  // ===========================================
  const getStatusColor = (status: string, conclusion: string | null) => {
    if (status === 'completed') {
      if (conclusion === 'success') return theme.palette.success;
      if (conclusion === 'failure') return theme.palette.error;
      if (conclusion === 'cancelled') return theme.palette.text.muted;
    }
    if (status === 'in_progress') return theme.palette.primary;
    if (status === 'queued') return theme.palette.warning;
    return theme.palette.text.muted;
  };

  const getStatusIcon = (status: string, conclusion: string | null) => {
    if (status === 'completed') {
      if (conclusion === 'success') return 'checkmark-circle';
      if (conclusion === 'failure') return 'close-circle';
      if (conclusion === 'cancelled') return 'stop-circle';
    }
    if (status === 'in_progress') return 'sync-circle';
    if (status === 'queued') return 'time';
    return 'ellipse-outline';
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `vor ${diffMins}m`;
    if (diffHours < 24) return `vor ${diffHours}h`;
    return `vor ${diffDays}d`;
  };

  // ===========================================
  // Render Functions
  // ===========================================
  const renderRepoItem = ({ item, index }: { item: GitHubRepo; index: number }) => {
    const isActive = item.full_name === activeRepo;
    const isRecent = recentRepos.includes(item.full_name);
    const isExpanded = expandedRepoId === item.id;

    return (
      <AnimatedView entering={FadeInDown.delay(index * 30).duration(300)}>
        <TouchableOpacity
          style={[styles.repoItem, isActive && styles.repoItemActive]}
          onPress={() => handleSelectRepo(item)}
          onLongPress={() => setExpandedRepoId(isExpanded ? null : item.id)}
        >
          <View style={styles.repoMain}>
            <View style={styles.repoNameRow}>
              <Ionicons
                name={item.private ? 'lock-closed' : 'globe-outline'}
                size={14}
                color={theme.palette.text.muted}
              />
              <Text style={styles.repoName}>{item.name}</Text>
              {isActive && (
                <View style={styles.activeIndicator}>
                  <Text style={styles.activeIndicatorText}>AKTIV</Text>
                </View>
              )}
            </View>
            <Text style={styles.repoFullName}>{item.full_name}</Text>

            {item.description && (
              <Text style={styles.repoDescription} numberOfLines={2}>
                {item.description}
              </Text>
            )}

            <View style={styles.repoMetaRow}>
              {item.language && (
                <View style={styles.metaChip}>
                  <View style={[styles.languageDot, { backgroundColor: getLanguageColor(item.language) }]} />
                  <Text style={styles.metaChipText}>{item.language}</Text>
                </View>
              )}
              <Text style={styles.repoMetaText}>
                {formatTimeAgo(item.updated_at)}
              </Text>
              {isRecent && <Text style={styles.repoChip}>Zuletzt</Text>}
            </View>

            {/* Expanded View */}
            {isExpanded && (
              <View style={styles.expandedActions}>
                <TouchableOpacity
                  style={styles.expandedButton}
                  onPress={() => handleOpenRepo(item)}
                >
                  <Ionicons name="open-outline" size={14} color={theme.palette.primary} />
                  <Text style={styles.expandedButtonText}>Öffnen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.expandedButton}
                  onPress={() => handlePush(item.full_name)}
                >
                  <Ionicons name="cloud-upload-outline" size={14} color={theme.palette.primary} />
                  <Text style={styles.expandedButtonText}>Push</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.repoActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => handleOpenRepo(item)}
            >
              <Ionicons
                name="open-outline"
                size={18}
                color={theme.palette.text.secondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => handlePush(item.full_name)}
              disabled={pushing}
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
      </AnimatedView>
    );
  };

  const renderActionsView = () => (
    <AnimatedView entering={FadeIn.duration(300)}>
      {loadingActions ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.palette.primary} />
          <Text style={styles.loadingText}>Lade Actions...</Text>
        </View>
      ) : workflowRuns.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="git-branch-outline" size={32} color={theme.palette.text.muted} />
          <Text style={styles.emptyText}>Keine Workflow-Runs gefunden</Text>
          <Text style={styles.emptySubtext}>
            Starte einen Build im Build-Screen oder pushe Code zu GitHub.
          </Text>
        </View>
      ) : (
        <>
          {/* Workflows Overview */}
          {workflows.length > 0 && (
            <View style={styles.workflowsCard}>
              <Text style={styles.cardTitle}>Workflows</Text>
              <View style={styles.workflowsList}>
                {workflows.map((wf) => (
                  <TouchableOpacity
                    key={wf.id}
                    style={styles.workflowItem}
                    onPress={() => handleOpenUrl(wf.html_url)}
                  >
                    <Ionicons
                      name="git-branch"
                      size={14}
                      color={wf.state === 'active' ? theme.palette.primary : theme.palette.text.muted}
                    />
                    <Text style={styles.workflowName}>{wf.name}</Text>
                    <View style={[
                      styles.workflowState,
                      wf.state === 'active' && styles.workflowStateActive,
                    ]}>
                      <Text style={styles.workflowStateText}>
                        {wf.state === 'active' ? 'Aktiv' : wf.state}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Recent Runs */}
          <View style={styles.runsCard}>
            <Text style={styles.cardTitle}>Letzte Runs</Text>
            {workflowRuns.map((run, index) => (
              <AnimatedView
                key={run.id}
                entering={FadeInDown.delay(index * 40).duration(250)}
              >
                <TouchableOpacity
                  style={styles.runItem}
                  onPress={() => handleOpenUrl(run.html_url)}
                >
                  <Ionicons
                    name={getStatusIcon(run.status, run.conclusion)}
                    size={20}
                    color={getStatusColor(run.status, run.conclusion)}
                  />
                  <View style={styles.runInfo}>
                    <Text style={styles.runTitle} numberOfLines={1}>
                      {run.display_title || run.name}
                    </Text>
                    <Text style={styles.runMeta}>
                      #{run.run_number} • {run.head_branch} • {formatTimeAgo(run.created_at)}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={theme.palette.text.muted}
                  />
                </TouchableOpacity>
              </AnimatedView>
            ))}
          </View>
        </>
      )}
    </AnimatedView>
  );

  const renderBranchesView = () => (
    <AnimatedView entering={FadeIn.duration(300)}>
      {loadingBranches ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.palette.primary} />
          <Text style={styles.loadingText}>Lade Branches...</Text>
        </View>
      ) : branches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="git-branch-outline" size={32} color={theme.palette.text.muted} />
          <Text style={styles.emptyText}>Keine Branches gefunden</Text>
        </View>
      ) : (
        <View style={styles.branchesCard}>
          <Text style={styles.cardTitle}>Branches ({branches.length})</Text>
          {branches.map((branch, index) => (
            <AnimatedView
              key={branch.name}
              entering={FadeInDown.delay(index * 30).duration(250)}
            >
              <View style={styles.branchItem}>
                <Ionicons
                  name={branch.name === defaultBranch ? 'git-branch' : 'git-commit-outline'}
                  size={16}
                  color={branch.name === defaultBranch ? theme.palette.primary : theme.palette.text.secondary}
                />
                <View style={styles.branchInfo}>
                  <Text style={[
                    styles.branchName,
                    branch.name === defaultBranch && styles.branchNameDefault,
                  ]}>
                    {branch.name}
                  </Text>
                  {branch.name === defaultBranch && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Default</Text>
                    </View>
                  )}
                </View>
                {branch.protected && (
                  <Ionicons
                    name="shield-checkmark"
                    size={14}
                    color={theme.palette.warning}
                  />
                )}
                <Text style={styles.branchSha}>
                  {branch.commit.sha.slice(0, 7)}
                </Text>
              </View>
            </AnimatedView>
          ))}
        </View>
      )}
    </AnimatedView>
  );

  const renderHeader = () => (
    <>
      {/* Header */}
      <AnimatedView entering={FadeIn.duration(400)} style={styles.header}>
        <View>
          <Text style={styles.title}>GitHub Repositories</Text>
          <Text style={styles.subtitle}>Projekt: {projectName}</Text>
        </View>
        <Ionicons
          name="logo-github"
          size={28}
          color={theme.palette.text.secondary}
        />
      </AnimatedView>

      {/* Token Status */}
      <AnimatedView entering={FadeInDown.delay(100).duration(400)} style={styles.tokenBox}>
        <Text style={styles.sectionTitle}>GitHub-Verbindung</Text>
        {tokenLoading && (
          <View style={styles.row}>
            <ActivityIndicator size="small" color={theme.palette.primary} />
            <Text style={styles.infoText}>Token wird geladen…</Text>
          </View>
        )}
        {!tokenLoading && token && (
          <View style={styles.row}>
            <Ionicons name="checkmark-circle" size={16} color={theme.palette.success} />
            <Text style={styles.successText}>Verbunden</Text>
          </View>
        )}
        {!tokenLoading && !token && (
          <Text style={styles.warningText}>
            ⚠️ Kein Token gefunden. Bitte im Screen „Verbindungen" hinterlegen.
          </Text>
        )}
        {tokenError && <Text style={styles.errorText}>{tokenError}</Text>}
      </AnimatedView>

      {/* Active Repo Card */}
      <AnimatedView entering={FadeInDown.delay(200).duration(400)} style={styles.activeBox}>
        <View style={styles.activeHeader}>
          <Text style={styles.sectionTitle}>Aktives Repository</Text>
          {activeRepo && (
            <TouchableOpacity onPress={() => setActiveRepo(null)}>
              <Text style={styles.linkText}>Trennen</Text>
            </TouchableOpacity>
          )}
        </View>
        {activeRepo ? (
          <>
            <View style={styles.activeRepoRow}>
              <Ionicons name="logo-github" size={18} color={theme.palette.text.secondary} />
              <Text style={styles.activeRepoName}>{activeRepo}</Text>
            </View>

            {/* View Mode Tabs */}
            <View style={styles.viewModeTabs}>
              <TouchableOpacity
                style={[styles.viewModeTab, viewMode === 'repos' && styles.viewModeTabActive]}
                onPress={() => setViewMode('repos')}
              >
                <Ionicons
                  name="folder-outline"
                  size={14}
                  color={viewMode === 'repos' ? theme.palette.primary : theme.palette.text.muted}
                />
                <Text style={[styles.viewModeTabText, viewMode === 'repos' && styles.viewModeTabTextActive]}>
                  Repos
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewModeTab, viewMode === 'actions' && styles.viewModeTabActive]}
                onPress={() => setViewMode('actions')}
              >
                <Ionicons
                  name="play-circle-outline"
                  size={14}
                  color={viewMode === 'actions' ? theme.palette.primary : theme.palette.text.muted}
                />
                <Text style={[styles.viewModeTabText, viewMode === 'actions' && styles.viewModeTabTextActive]}>
                  Actions
                </Text>
                {workflowRuns.some(r => r.status === 'in_progress') && (
                  <View style={styles.runningDot} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewModeTab, viewMode === 'branches' && styles.viewModeTabActive]}
                onPress={() => setViewMode('branches')}
              >
                <Ionicons
                  name="git-branch-outline"
                  size={14}
                  color={viewMode === 'branches' ? theme.palette.primary : theme.palette.text.muted}
                />
                <Text style={[styles.viewModeTabText, viewMode === 'branches' && styles.viewModeTabTextActive]}>
                  Branches
                </Text>
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <View style={styles.activeActionsRow}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => handlePush()}
                disabled={pushing}
              >
                {pushing ? (
                  <ActivityIndicator size="small" color={theme.palette.background} />
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
              <TouchableOpacity
                style={styles.outlineButtonSmall}
                onPress={() => handleOpenUrl(`https://github.com/${activeRepo}`)}
              >
                <Ionicons name="open-outline" size={14} color={theme.palette.primary} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View>
            <Text style={styles.infoText}>
              Kein aktives Repo ausgewählt. Wähle eines aus der Liste oder erstelle ein neues für dieses Projekt.
            </Text>
            <TouchableOpacity
              style={styles.outlineButton}
              onPress={handleCreateRepo}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator size="small" color={theme.palette.primary} />
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
      </AnimatedView>

      {/* Actions/Branches View (wenn aktives Repo) */}
      {activeRepo && viewMode === 'actions' && renderActionsView()}
      {activeRepo && viewMode === 'branches' && renderBranchesView()}

      {/* Filter/Search (nur für Repos View) */}
      {(!activeRepo || viewMode === 'repos') && (
        <>
          <AnimatedView entering={FadeInUp.delay(300).duration(400)} style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}
              onPress={() => setFilterType('all')}
            >
              <Text style={[styles.filterButtonText, filterType === 'all' && styles.filterButtonTextActive]}>
                Alle
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'activeOnly' && styles.filterButtonActive]}
              onPress={() => setFilterType('activeOnly')}
            >
              <Text style={[styles.filterButtonText, filterType === 'activeOnly' && styles.filterButtonTextActive]}>
                Aktiv
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'recentOnly' && styles.filterButtonActive]}
              onPress={() => setFilterType('recentOnly')}
            >
              <Text style={[styles.filterButtonText, filterType === 'recentOnly' && styles.filterButtonTextActive]}>
                Zuletzt
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.reloadButton} onPress={loadRepos}>
              <Ionicons name="refresh-outline" size={16} color={theme.palette.text.primary} />
            </TouchableOpacity>
          </AnimatedView>

          <TextInput
            style={styles.searchInput}
            placeholder="Repos suchen…"
            placeholderTextColor={theme.palette.text.secondary}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />

          {/* Recent Repos Chips */}
          {recentRepos.length > 0 && (
            <ScrollView
              style={styles.recentScroll}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {recentRepos.map((fullName) => (
                <TouchableOpacity
                  key={fullName}
                  style={[
                    styles.recentChip,
                    fullName === activeRepo && styles.recentChipActive,
                  ]}
                  onPress={() => handleSelectRepo({
                    id: 0,
                    name: fullName.split('/').slice(-1)[0],
                    full_name: fullName,
                    private: true,
                    updated_at: new Date().toISOString(),
                    html_url: `https://github.com/${fullName}`,
                    default_branch: 'main',
                    owner: { login: fullName.split('/')[0] },
                  })}
                  onLongPress={() => clearRecentRepos()}
                >
                  <Text style={[
                    styles.recentChipText,
                    fullName === activeRepo && styles.recentChipTextActive,
                  ]}>
                    {fullName.split('/')[1]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {errorRepos && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={theme.palette.error} />
              <Text style={styles.errorText}>{errorRepos}</Text>
            </View>
          )}
        </>
      )}
    </>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.container}>
        <FlatList
          data={(!activeRepo || viewMode === 'repos') ? filteredRepos : []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRepoItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            !loadingRepos && (!activeRepo || viewMode === 'repos') ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="folder-open-outline" size={32} color={theme.palette.text.muted} />
                <Text style={styles.emptyText}>Keine Repositories gefunden</Text>
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.palette.primary}
            />
          }
        />

        {loadingRepos && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.palette.primary} />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

// ===========================================
// Helper Functions
// ===========================================
const getLanguageColor = (language: string): string => {
  const colors: Record<string, string> = {
    TypeScript: '#3178c6',
    JavaScript: '#f7df1e',
    Python: '#3776ab',
    Java: '#b07219',
    'C++': '#f34b7d',
    Go: '#00add8',
    Rust: '#dea584',
    Swift: '#ffac45',
    Kotlin: '#a97bff',
    Ruby: '#701516',
    PHP: '#4f5d95',
    default: theme.palette.text.muted,
  };
  return colors[language] || colors.default;
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  container: {
    flex: 1,
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
    fontSize: 22,
    fontWeight: '700',
    color: theme.palette.text.primary,
  },
  subtitle: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  tokenBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginBottom: 6,
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
  successText: {
    fontSize: 12,
    color: theme.palette.success,
    fontWeight: '500',
  },
  warningText: {
    fontSize: 12,
    color: theme.palette.warning,
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: theme.palette.error,
    flex: 1,
  },
  linkText: {
    fontSize: 12,
    color: theme.palette.primary,
  },
  activeBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginBottom: 10,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeRepoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  activeRepoName: {
    fontSize: 14,
    color: theme.palette.text.primary,
    fontWeight: '600',
  },
  viewModeTabs: {
    flexDirection: 'row',
    backgroundColor: theme.palette.secondary,
    borderRadius: 8,
    padding: 4,
    marginBottom: 12,
  },
  viewModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  viewModeTabActive: {
    backgroundColor: theme.palette.card,
  },
  viewModeTabText: {
    fontSize: 11,
    color: theme.palette.text.muted,
    fontWeight: '500',
  },
  viewModeTabTextActive: {
    color: theme.palette.primary,
    fontWeight: '600',
  },
  runningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.primary,
  },
  activeActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 10,
    backgroundColor: theme.palette.primary,
    gap: 6,
  },
  primaryButtonText: {
    fontSize: 14,
    color: theme.palette.background,
    fontWeight: '600',
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.palette.primary,
    marginTop: 10,
    gap: 6,
  },
  outlineButtonSmall: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.palette.primary,
  },
  outlineButtonText: {
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  filterButtonActive: {
    backgroundColor: theme.palette.primarySoft,
    borderColor: theme.palette.primary,
  },
  filterButtonText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  filterButtonTextActive: {
    color: theme.palette.primary,
    fontWeight: '600',
  },
  reloadButton: {
    marginLeft: 'auto',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.palette.text.primary,
    fontSize: 14,
    marginBottom: 10,
    backgroundColor: theme.palette.card,
  },
  recentScroll: {
    marginBottom: 10,
  },
  recentChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.palette.chip.background,
    borderWidth: 1,
    borderColor: theme.palette.chip.border,
    marginRight: 8,
  },
  recentChipActive: {
    backgroundColor: theme.palette.primarySoft,
    borderColor: theme.palette.primary,
  },
  recentChipText: {
    fontSize: 12,
    color: theme.palette.chip.text,
  },
  recentChipTextActive: {
    color: theme.palette.primary,
    fontWeight: '600',
  },
  repoItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: theme.palette.card,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  repoItemActive: {
    borderColor: theme.palette.primary,
    backgroundColor: theme.palette.primarySoft,
  },
  repoMain: {
    flex: 1,
    paddingRight: 8,
  },
  repoNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  repoName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  activeIndicator: {
    backgroundColor: theme.palette.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeIndicatorText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.palette.background,
  },
  repoFullName: {
    fontSize: 11,
    color: theme.palette.text.muted,
    marginTop: 2,
  },
  repoDescription: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 6,
    lineHeight: 16,
  },
  repoMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaChipText: {
    fontSize: 11,
    color: theme.palette.text.secondary,
  },
  languageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  repoMetaText: {
    fontSize: 11,
    color: theme.palette.text.muted,
  },
  repoChip: {
    fontSize: 10,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.chip.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  expandedActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
  },
  expandedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: theme.palette.primarySoft,
    borderRadius: 6,
  },
  expandedButtonText: {
    fontSize: 12,
    color: theme.palette.primary,
    fontWeight: '500',
  },
  repoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    padding: 8,
  },
  // Actions View Styles
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
    color: theme.palette.text.muted,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: theme.palette.text.muted,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 12,
    color: theme.palette.text.muted,
    textAlign: 'center',
  },
  workflowsCard: {
    backgroundColor: theme.palette.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginBottom: 10,
  },
  workflowsList: {
    gap: 8,
  },
  workflowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workflowName: {
    flex: 1,
    fontSize: 13,
    color: theme.palette.text.primary,
  },
  workflowState: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: theme.palette.secondary,
  },
  workflowStateActive: {
    backgroundColor: theme.palette.primarySoft,
  },
  workflowStateText: {
    fontSize: 10,
    color: theme.palette.text.muted,
    fontWeight: '500',
  },
  runsCard: {
    backgroundColor: theme.palette.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  runItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    gap: 10,
  },
  runInfo: {
    flex: 1,
  },
  runTitle: {
    fontSize: 13,
    color: theme.palette.text.primary,
    fontWeight: '500',
  },
  runMeta: {
    fontSize: 11,
    color: theme.palette.text.muted,
    marginTop: 2,
  },
  // Branches View Styles
  branchesCard: {
    backgroundColor: theme.palette.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  branchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    gap: 8,
  },
  branchInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  branchName: {
    fontSize: 13,
    color: theme.palette.text.primary,
    fontFamily: 'monospace',
  },
  branchNameDefault: {
    fontWeight: '600',
    color: theme.palette.primary,
  },
  defaultBadge: {
    backgroundColor: theme.palette.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: theme.palette.primary,
  },
  branchSha: {
    fontSize: 11,
    color: theme.palette.text.muted,
    fontFamily: 'monospace',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,68,68,0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
});

export default GitHubReposScreen;
