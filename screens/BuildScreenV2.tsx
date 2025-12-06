import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';

import { theme } from '../theme';
import { useBuildStatus } from '../hooks/useBuildStatus';
import { ensureSupabaseClient } from '../lib/supabase';
import { useGitHub } from '../contexts/GitHubContext';

const BuildScreenV2: React.FC = () => {
  const { activeRepo } = useGitHub();
  const [jobId, setJobId] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const { status, details, errorCount, lastError, isPolling } = useBuildStatus(
    jobId,
  );

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

      const { data, error } = await supabase.functions.invoke(
        'trigger-eas-build',
        {
          body: {
            repoFullName: activeRepo,
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
          'Fehler',
          'Build wurde gestartet, aber Job-ID konnte nicht gelesen werden.',
        );
        return;
      }

      setJobId(parsed);
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

  const renderStatusText = () => {
    switch (status) {
      case 'idle':
        return 'Bereit. Starte einen neuen Build.';
      case 'queued':
        return 'Build ist in der Warteschlange.';
      case 'building':
        return 'Build läuft...';
      case 'success':
        return 'Build erfolgreich abgeschlossen.';
      case 'failed':
        return 'Build fehlgeschlagen.';
      case 'error':
        return 'Fehler beim Abfragen des Build-Status.';
      default:
        return status;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>EAS Build</Text>
      <Text style={styles.subtitle}>
        Triggert einen EAS-Build über deine Supabase Edge Functions.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Repository</Text>
        {activeRepo ? (
          <Text style={styles.cardText}>{activeRepo}</Text>
        ) : (
          <Text style={styles.warningText}>
            Kein aktives Repo gewählt. Wähle eines im GitHub-Screen aus.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Build starten</Text>
        <Text style={styles.cardText}>
          Starte einen neuen EAS-Build für das aktive Repository. Der Status
          wird automatisch abgefragt.
        </Text>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            (!activeRepo || isStarting || isPolling) && styles.buttonDisabled,
          ]}
          onPress={startBuild}
          disabled={!activeRepo || isStarting || isPolling}
        >
          {isStarting ? (
            <ActivityIndicator
              size="small"
              color={theme.palette.background}
            />
          ) : (
            <Text style={styles.primaryButtonText}>
              {jobId ? 'Erneut starten' : 'Build starten'}
            </Text>
          )}
        </TouchableOpacity>

        {jobId && (
          <Text style={styles.jobText}>Aktueller Job: #{jobId}</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Status</Text>
        <Text style={styles.statusText}>{renderStatusText()}</Text>

        {details?.urls?.html && (
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => openUrl(details.urls?.html)}
          >
            <Text style={styles.linkButtonText}>Build-Details aufrufen</Text>
          </TouchableOpacity>
        )}

        {details?.urls?.artifacts && (
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => openUrl(details.urls?.artifacts)}
          >
            <Text style={styles.linkButtonText}>Artifacts öffnen</Text>
          </TouchableOpacity>
        )}

        {lastError && (
          <Text style={styles.errorText}>
            Letzter Fehler ({errorCount}x): {lastError}
          </Text>
        )}
      </View>
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
    paddingBottom: 32,
  },
  title: {
    color: theme.palette.text.primary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: 13,
    marginBottom: 12,
  },
  card: {
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  cardTitle: {
    color: theme.palette.text.primary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  cardText: {
    color: theme.palette.text.secondary,
    fontSize: 13,
  },
  primaryButton: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: theme.palette.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: theme.palette.background,
    fontSize: 14,
    fontWeight: '600',
  },
  jobText: {
    marginTop: 8,
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  statusText: {
    marginTop: 4,
    fontSize: 13,
    color: theme.palette.text.primary,
  },
  warningText: {
    fontSize: 12,
    color: theme.palette.warning,
  },
  errorText: {
    fontSize: 12,
    color: theme.palette.error,
    marginTop: 8,
  },
  linkButton: {
    marginTop: 12,
    backgroundColor: theme.palette.secondary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  linkButtonText: {
    color: theme.palette.text.primary,
    fontSize: 13,
  },
});

export default BuildScreenV2;
