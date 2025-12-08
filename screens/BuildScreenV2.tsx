// screens/BuildScreenV2.tsx
// Erweiterter Build-Screen mit Live-Status wie GitHub Actions
// ✅ Detaillierte Step-Visualisierung
// ✅ Live-Log-Protokoll
// ✅ Progress-Bar mit Phasen
// ✅ Build-History
// ✅ Artifact-Download
// ✅ Workflow Actions (Cancel, Rerun)

import React, { useState, useEffect, useCallback } from 'react';
import {
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  StyleSheet,
  ScrollView,
  Alert,
  View,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import { useBuildStatus } from '../hooks/useBuildStatus';
import { useGitHubActionsLive } from '../hooks/useGitHubActionsLive';
import { ensureSupabaseClient } from '../lib/supabase';
import { useGitHub } from '../contexts/GitHubContext';
import { getExpoToken } from '../contexts/ProjectContext';
import { GitHubWorkflowRun } from '../contexts/types';

// Components
import BuildLogViewer from '../components/BuildLogViewer';
import BuildStepsView from '../components/BuildStepsView';
import BuildProgressBar from '../components/BuildProgressBar';

const EAS_PROJECT_ID_STORAGE_KEY = 'eas_project_id';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedView = Animated.View;

type TabType = 'status' | 'logs' | 'history';

const BuildScreenV2: React.FC = () => {
  const { activeRepo } = useGitHub();
  const [jobId, setJobId] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('status');
  const [buildHistory, setBuildHistory] = useState<GitHubWorkflowRun[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Legacy Hook für Supabase Job-Tracking
  const { status: legacyStatus, details: legacyDetails, errorCount, lastError, isPolling } = useBuildStatus(jobId);

  // Neuer Hook für detaillierten GitHub Actions Status
  const {
    status: liveStatus,
    isLoading: isLoadingLive,
    isPolling: isPollingLive,
    error: liveError,
    refresh: refreshLive,
    cancelRun,
    rerunRun,
    getWorkflowRuns,
  } = useGitHubActionsLive({
    repoFullName: activeRepo,
    autoStart: !!activeRepo,
  });

  // Animation values
  const buttonScale = useSharedValue(1);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleButtonPressIn = () => {
    buttonScale.value = withSpring(0.95, { damping: 15 });
  };

  const handleButtonPressOut = () => {
    buttonScale.value = withSpring(1, { damping: 15 });
  };

  // Build History laden
  const loadBuildHistory = useCallback(async () => {
    if (!activeRepo) return;

    try {
      setIsLoadingHistory(true);
      const runs = await getWorkflowRuns(10);
      setBuildHistory(runs);
    } catch (e) {
      console.log('[BuildScreenV2] History load error:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [activeRepo, getWorkflowRuns]);

  useEffect(() => {
    if (activeRepo) {
      loadBuildHistory();
    }
  }, [activeRepo, loadBuildHistory]);

  // Pull-to-Refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshLive(), loadBuildHistory()]);
    setRefreshing(false);
  }, [refreshLive, loadBuildHistory]);

  // Build starten
  const startBuild = async () => {
    if (!activeRepo) {
      Alert.alert(
        'Kein Repo',
        'Bitte zuerst im GitHub-Screen ein aktives Repository auswählen.',
      );
      return;
    }

    try {
      setIsStarting(true);
      const supabase = await ensureSupabaseClient();
      const [storedProjectId, storedEasToken] = await Promise.all([
        AsyncStorage.getItem(EAS_PROJECT_ID_STORAGE_KEY),
        getExpoToken().catch(() => null),
      ]);

      const easProjectId = storedProjectId?.trim() || null;
      const easToken = storedEasToken?.trim() || null;

      const { data, error } = await supabase.functions.invoke(
        'trigger-eas-build',
        {
          body: {
            repoFullName: activeRepo,
            easProjectId,
            easToken,
          },
        },
      );

      if (error) {
        console.log('[BuildScreenV2] trigger-eas-build error:', error);
        Alert.alert(
          'Fehler',
          error.message ?? 'Build konnte nicht gestartet werden.',
        );
        return;
      }

      const rawJobId =
        (data as any)?.jobId ??
        (data as any)?.job_id ??
        (data as any)?.id;

      const parsed = Number(rawJobId);
      if (!rawJobId || Number.isNaN(parsed)) {
        console.log(
          '[BuildScreenV2] Unerwartete Antwort von trigger-eas-build:',
          data,
        );
        Alert.alert(
          'Info',
          'Build wurde gestartet. Status wird geladen...',
        );
        // Trotzdem refreshen
        setTimeout(() => refreshLive(), 2000);
        return;
      }

      setJobId(parsed);
      setActiveTab('status');

      // Nach kurzer Zeit den Live-Status refreshen
      setTimeout(() => refreshLive(), 3000);
    } catch (e: any) {
      console.log('[BuildScreenV2] Build-Error:', e);
      Alert.alert(
        'Fehler',
        e?.message ?? 'Build konnte nicht gestartet werden.',
      );
    } finally {
      setIsStarting(false);
    }
  };

  const openUrl = (url?: string | null) => {
    if (!url) return;
    Linking.openURL(url).catch((e) => {
      console.log('[BuildScreenV2] Linking-Error:', e);
      Alert.alert('Fehler', 'Link konnte nicht geöffnet werden.');
    });
  };

  const handleCancelBuild = async () => {
    Alert.alert(
      'Build abbrechen?',
      'Möchtest du den aktuellen Build wirklich abbrechen?',
      [
        { text: 'Nein', style: 'cancel' },
        {
          text: 'Ja, abbrechen',
          style: 'destructive',
          onPress: async () => {
            const success = await cancelRun();
            if (success) {
              Alert.alert('Erfolg', 'Build wurde abgebrochen.');
            } else {
              Alert.alert('Fehler', 'Build konnte nicht abgebrochen werden.');
            }
          },
        },
      ],
    );
  };

  const handleRerunBuild = async () => {
    const success = await rerunRun();
    if (success) {
      Alert.alert('Erfolg', 'Build wird neu gestartet...');
      setActiveTab('status');
    } else {
      Alert.alert('Fehler', 'Build konnte nicht neu gestartet werden.');
    }
  };

  // Status Text
  const getStatusText = (): string => {
    if (isLoadingLive) return 'Lade Status...';

    switch (liveStatus.phase) {
      case 'idle':
        return 'Bereit. Starte einen neuen Build.';
      case 'queued':
        return 'Build ist in der Warteschlange...';
      case 'checkout':
        return 'Repository wird ausgecheckt...';
      case 'setup':
        return 'Umgebung wird eingerichtet...';
      case 'install':
        return 'Abhängigkeiten werden installiert...';
      case 'building':
        return 'Build läuft...';
      case 'uploading':
        return 'Artefakte werden hochgeladen...';
      case 'success':
        return 'Build erfolgreich abgeschlossen!';
      case 'failed':
        return 'Build fehlgeschlagen.';
      case 'error':
        return 'Fehler beim Abfragen des Status.';
      default:
        return liveStatus.phase;
    }
  };

  // Duration formatieren
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '--';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Render Tab Content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'status':
        return renderStatusTab();
      case 'logs':
        return renderLogsTab();
      case 'history':
        return renderHistoryTab();
    }
  };

  const renderStatusTab = () => (
    <AnimatedView entering={FadeIn.duration(300)}>
      {/* Progress Bar */}
      <View style={styles.card}>
        <BuildProgressBar
          progress={liveStatus.progress}
          phase={liveStatus.phase}
          showPercentage
          showPhaseLabel
        />

        {/* Duration Info */}
        {liveStatus.totalDuration && (
          <View style={styles.durationRow}>
            <Ionicons
              name="time-outline"
              size={14}
              color={theme.palette.text.secondary}
            />
            <Text style={styles.durationText}>
              Dauer: {formatDuration(liveStatus.totalDuration)}
            </Text>
          </View>
        )}
      </View>

      {/* Steps */}
      {liveStatus.steps.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Build-Schritte</Text>
          <BuildStepsView steps={liveStatus.steps} />
        </View>
      )}

      {/* Run Info */}
      {liveStatus.run && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Workflow-Run</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Run #</Text>
            <Text style={styles.infoValue}>{liveStatus.run.run_number}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Branch</Text>
            <Text style={styles.infoValue}>{liveStatus.run.head_branch}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Commit</Text>
            <Text style={styles.infoValueMono}>
              {liveStatus.run.head_sha?.slice(0, 7)}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.runActions}>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => openUrl(liveStatus.run?.html_url)}
            >
              <Ionicons name="open-outline" size={14} color={theme.palette.primary} />
              <Text style={styles.linkButtonText}>Auf GitHub öffnen</Text>
            </TouchableOpacity>

            {['queued', 'checkout', 'setup', 'install', 'building', 'uploading'].includes(liveStatus.phase) && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelBuild}
              >
                <Ionicons name="stop-circle-outline" size={14} color={theme.palette.error} />
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </TouchableOpacity>
            )}

            {['failed', 'error'].includes(liveStatus.phase) && (
              <TouchableOpacity
                style={styles.rerunButton}
                onPress={handleRerunBuild}
              >
                <Ionicons name="refresh-outline" size={14} color={theme.palette.warning} />
                <Text style={styles.rerunButtonText}>Neu starten</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Artifacts */}
      {liveStatus.artifacts.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Artefakte</Text>
          {liveStatus.artifacts.map((artifact) => (
            <TouchableOpacity
              key={artifact.id}
              style={styles.artifactRow}
              onPress={() => openUrl(artifact.archive_download_url)}
            >
              <Ionicons
                name="cube-outline"
                size={18}
                color={theme.palette.primary}
              />
              <View style={styles.artifactInfo}>
                <Text style={styles.artifactName}>{artifact.name}</Text>
                <Text style={styles.artifactSize}>
                  {(artifact.size_in_bytes / 1024 / 1024).toFixed(2)} MB
                </Text>
              </View>
              <Ionicons
                name="download-outline"
                size={18}
                color={theme.palette.text.secondary}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </AnimatedView>
  );

  const renderLogsTab = () => (
    <AnimatedView entering={FadeIn.duration(300)}>
      <View style={styles.logsContainer}>
        <BuildLogViewer
          logs={liveStatus.logs}
          maxHeight={500}
          autoScroll
          showTimestamp
        />
      </View>

      {liveError && (
        <View style={styles.errorCard}>
          <Ionicons name="warning-outline" size={16} color={theme.palette.error} />
          <Text style={styles.errorCardText}>{liveError}</Text>
        </View>
      )}
    </AnimatedView>
  );

  const renderHistoryTab = () => (
    <AnimatedView entering={FadeIn.duration(300)}>
      {isLoadingHistory ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.palette.primary} />
          <Text style={styles.loadingText}>Lade Build-History...</Text>
        </View>
      ) : buildHistory.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="archive-outline" size={32} color={theme.palette.text.muted} />
          <Text style={styles.emptyText}>Keine Build-History gefunden</Text>
        </View>
      ) : (
        <View style={styles.historyList}>
          {buildHistory.map((run, index) => (
            <AnimatedView
              key={run.id}
              entering={FadeInDown.delay(index * 50).duration(300)}
            >
              <TouchableOpacity
                style={styles.historyItem}
                onPress={() => openUrl(run.html_url)}
              >
                <View style={styles.historyStatus}>
                  <Ionicons
                    name={
                      run.conclusion === 'success' ? 'checkmark-circle' :
                        run.conclusion === 'failure' ? 'close-circle' :
                          run.status === 'in_progress' ? 'sync-circle' :
                            'ellipse-outline'
                    }
                    size={20}
                    color={
                      run.conclusion === 'success' ? theme.palette.success :
                        run.conclusion === 'failure' ? theme.palette.error :
                          run.status === 'in_progress' ? theme.palette.primary :
                            theme.palette.text.muted
                    }
                  />
                </View>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyTitle}>
                    Run #{run.run_number}
                  </Text>
                  <Text style={styles.historyMeta}>
                    {run.head_branch} • {new Date(run.created_at).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
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
      )}
    </AnimatedView>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.palette.primary}
        />
      }
    >
      {/* Header */}
      <AnimatedView entering={FadeIn.duration(400)}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Build & Deploy</Text>
            <Text style={styles.subtitle}>
              EAS Build mit Live-Status-Tracking
            </Text>
          </View>
          {isPollingLive && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
      </AnimatedView>

      {/* Repository Card */}
      <AnimatedView
        entering={FadeInDown.delay(100).duration(500).springify()}
        style={styles.card}
      >
        <Text style={styles.cardTitle}>Repository</Text>
        {activeRepo ? (
          <View style={styles.repoInfo}>
            <Ionicons name="logo-github" size={18} color={theme.palette.text.secondary} />
            <Text style={styles.repoName}>{activeRepo}</Text>
          </View>
        ) : (
          <Text style={styles.warningText}>
            Kein aktives Repo gewählt. Wähle eines im GitHub-Screen aus.
          </Text>
        )}
      </AnimatedView>

      {/* Start Build Card */}
      <AnimatedView
        entering={FadeInDown.delay(200).duration(500).springify()}
        style={styles.card}
      >
        <AnimatedTouchableOpacity
          style={[
            styles.primaryButton,
            buttonAnimatedStyle,
            (!activeRepo || isStarting || isPollingLive) && styles.buttonDisabled,
          ]}
          onPress={startBuild}
          onPressIn={handleButtonPressIn}
          onPressOut={handleButtonPressOut}
          disabled={!activeRepo || isStarting || isPollingLive}
        >
          {isStarting ? (
            <ActivityIndicator size="small" color={theme.palette.background} />
          ) : (
            <>
              <Ionicons
                name="rocket-outline"
                size={18}
                color={theme.palette.background}
              />
              <Text style={styles.primaryButtonText}>
                {isPollingLive ? 'Build läuft...' : 'Build starten'}
              </Text>
            </>
          )}
        </AnimatedTouchableOpacity>

        {jobId && (
          <Text style={styles.jobText}>Supabase Job: #{jobId}</Text>
        )}
      </AnimatedView>

      {/* Status Text */}
      <AnimatedView
        entering={FadeInDown.delay(300).duration(500).springify()}
        style={[
          styles.statusCard,
          liveStatus.phase === 'success' && styles.successCard,
          ['failed', 'error'].includes(liveStatus.phase) && styles.errorStatusCard,
        ]}
      >
        <Text
          style={[
            styles.statusText,
            liveStatus.phase === 'success' && styles.successText,
            ['failed', 'error'].includes(liveStatus.phase) && styles.errorText,
          ]}
        >
          {getStatusText()}
        </Text>
      </AnimatedView>

      {/* Tab Navigation */}
      <AnimatedView
        entering={FadeInUp.delay(400).duration(400)}
        style={styles.tabRow}
      >
        <TouchableOpacity
          style={[styles.tab, activeTab === 'status' && styles.tabActive]}
          onPress={() => setActiveTab('status')}
        >
          <Ionicons
            name="pulse-outline"
            size={16}
            color={activeTab === 'status' ? theme.palette.primary : theme.palette.text.muted}
          />
          <Text style={[styles.tabText, activeTab === 'status' && styles.tabTextActive]}>
            Status
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'logs' && styles.tabActive]}
          onPress={() => setActiveTab('logs')}
        >
          <Ionicons
            name="terminal-outline"
            size={16}
            color={activeTab === 'logs' ? theme.palette.primary : theme.palette.text.muted}
          />
          <Text style={[styles.tabText, activeTab === 'logs' && styles.tabTextActive]}>
            Protokoll
          </Text>
          {liveStatus.logs.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{liveStatus.logs.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={activeTab === 'history' ? theme.palette.primary : theme.palette.text.muted}
          />
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            History
          </Text>
        </TouchableOpacity>
      </AnimatedView>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {renderTabContent()}
      </View>

      {/* Legacy Error Display */}
      {lastError && (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={16} color={theme.palette.error} />
          <Text style={styles.errorCardText}>
            Supabase Fehler ({errorCount}x): {lastError}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    color: theme.palette.text.primary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: 13,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,0,0,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff0000',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ff0000',
  },
  card: {
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  statusCard: {
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    alignItems: 'center',
  },
  successCard: {
    borderColor: theme.palette.success,
    backgroundColor: theme.palette.successSoft,
  },
  errorStatusCard: {
    borderColor: theme.palette.error,
    backgroundColor: 'rgba(255,68,68,0.05)',
  },
  cardTitle: {
    color: theme.palette.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  repoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  repoName: {
    color: theme.palette.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  warningText: {
    fontSize: 12,
    color: theme.palette.warning,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: theme.palette.primary,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: theme.palette.background,
    fontSize: 15,
    fontWeight: '700',
  },
  jobText: {
    marginTop: 8,
    fontSize: 11,
    color: theme.palette.text.muted,
    textAlign: 'center',
  },
  statusText: {
    fontSize: 14,
    color: theme.palette.text.primary,
    fontWeight: '500',
  },
  successText: {
    color: theme.palette.success,
    fontWeight: '600',
  },
  errorText: {
    color: theme.palette.error,
    fontWeight: '600',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
  },
  durationText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  infoLabel: {
    fontSize: 12,
    color: theme.palette.text.muted,
  },
  infoValue: {
    fontSize: 12,
    color: theme.palette.text.primary,
    fontWeight: '500',
  },
  infoValueMono: {
    fontSize: 12,
    color: theme.palette.text.primary,
    fontFamily: 'monospace',
  },
  runActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: theme.palette.primarySoft,
    borderRadius: 6,
  },
  linkButtonText: {
    fontSize: 12,
    color: theme.palette.primary,
    fontWeight: '500',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderRadius: 6,
  },
  cancelButtonText: {
    fontSize: 12,
    color: theme.palette.error,
    fontWeight: '500',
  },
  rerunButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: theme.palette.warningSoft,
    borderRadius: 6,
  },
  rerunButtonText: {
    fontSize: 12,
    color: theme.palette.warning,
    fontWeight: '500',
  },
  artifactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  artifactInfo: {
    flex: 1,
  },
  artifactName: {
    fontSize: 13,
    color: theme.palette.text.primary,
    fontWeight: '500',
  },
  artifactSize: {
    fontSize: 11,
    color: theme.palette.text.muted,
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: theme.palette.card,
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tabActive: {
    backgroundColor: theme.palette.primarySoft,
  },
  tabText: {
    fontSize: 12,
    color: theme.palette.text.muted,
    fontWeight: '500',
  },
  tabTextActive: {
    color: theme.palette.primary,
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: theme.palette.primary,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.palette.background,
  },
  tabContent: {
    minHeight: 200,
  },
  logsContainer: {
    marginBottom: 12,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,68,68,0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  errorCardText: {
    flex: 1,
    fontSize: 12,
    color: theme.palette.error,
  },
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
    fontSize: 12,
    color: theme.palette.text.muted,
  },
  historyList: {
    gap: 8,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.palette.card,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    gap: 12,
  },
  historyStatus: {
    width: 24,
    alignItems: 'center',
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 13,
    color: theme.palette.text.primary,
    fontWeight: '600',
  },
  historyMeta: {
    fontSize: 11,
    color: theme.palette.text.muted,
    marginTop: 2,
  },
});

export default BuildScreenV2;
