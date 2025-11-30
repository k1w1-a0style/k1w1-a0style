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
  const { status, details } = useBuildStatus(jobId);

  const startBuild = async () => {
    try {
      if (!activeRepo) {
        Alert.alert(
          'Kein Repo ausgewählt',
          'Bitte wähle zuerst ein GitHub-Repo im „GitHub Repos“-Screen aus.'
        );
        return;
      }

      setIsStarting(true);
      const supabase = await ensureSupabaseClient();

      const { data, error: fnError } = await supabase.functions.invoke(
        'trigger-eas-build',
        {
          body: {
            githubRepo: activeRepo,
            buildProfile: 'preview', // oder "production"
            buildType: 'normal',
          },
        }
      );

      console.log('[BuildScreenV2] trigger-eas-build response:', data, fnError);

      if (fnError || !data?.ok || !data?.job?.id) {
        console.log('[BuildScreenV2] Unexpected trigger response:', data, fnError);
        Alert.alert(
          'Fehler',
          data?.error ??
            fnError?.message ??
            'Fehler beim Start des Build-Jobs.'
        );
        return;
      }

      setJobId(data.job.id as number);
    } catch (e: any) {
      console.log('[BuildScreenV2] Build-Error:', e);
      Alert.alert(
        'Fehler',
        e?.message ?? 'Build konnte nicht gestartet werden.'
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

  const renderStatus = () => {
    if (!jobId) {
      return (
        <Text style={styles.hintText}>
          Noch kein Build gestartet. Starte oben einen neuen EAS-Build.
        </Text>
      );
    }

    return (
      <View style={styles.statusBox}>
        <Text style={styles.label}>Job ID:</Text>
        <Text style={styles.jobId}>{jobId}</Text>

        <View style={styles.statusRow}>
          <Text style={styles.label}>Status: </Text>

          {status === 'queued' && (
            <Text style={styles.statusQueued}>⏳ Warteschlange…</Text>
          )}

          {status === 'building' && (
            <Text style={styles.statusBuilding}>🔧 Build läuft…</Text>
          )}

          {status === 'success' && (
            <Text style={styles.statusSuccess}>✅ Build erfolgreich!</Text>
          )}

          {status === 'failed' && (
            <Text style={styles.statusFailed}>❌ Build fehlgeschlagen</Text>
          )}

          {status === 'idle' && (
            <Text style={styles.statusIdle}>⌛ Warten auf Status…</Text>
          )}

          {status === 'error' && (
            <Text style={styles.statusFailed}>
              ⚠️ Fehler beim Abrufen des Status
            </Text>
          )}
        </View>

        {details?.urls?.html && (
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => openUrl(details.urls?.html)}
          >
            <Text style={styles.linkButtonText}>🔗 GitHub Actions öffnen</Text>
          </TouchableOpacity>
        )}

        {details?.urls?.artifacts && (
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => openUrl(details.urls?.artifacts)}
          >
            <Text style={styles.linkButtonText}>📦 Artefakte / Download</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>📦 EAS Build (Supabase + GitHub)</Text>

      <TouchableOpacity
        style={styles.buildButton}
        onPress={startBuild}
        disabled={isStarting}
      >
        {isStarting ? (
          <ActivityIndicator color={theme.palette.secondary} />
        ) : (
          <Text style={styles.buildButtonText}>🚀 Build über Supabase starten</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.hintText}>
        Dieser Screen nutzt die Supabase-Function{' '}
        <Text style={{ fontWeight: 'bold' }}>trigger-eas-build</Text> und
        pollt anschließend den Status über{' '}
        <Text style={{ fontWeight: 'bold' }}>check-eas-build</Text>.
      </Text>

      {renderStatus()}
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
  },
  title: {
    color: theme.palette.text.primary,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  buildButton: {
    backgroundColor: theme.palette.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  buildButtonText: {
    color: theme.palette.secondary,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  hintText: {
    color: theme.palette.text.secondary,
    marginTop: 4,
  },
  statusBox: {
    marginTop: 20,
    padding: 12,
    borderRadius: 8,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  label: {
    color: theme.palette.text.secondary,
    fontSize: 14,
  },
  jobId: {
    color: theme.palette.text.primary,
    fontSize: 16,
    marginBottom: 8,
  },
  statusRow: {
    marginTop: 4,
  },
  statusQueued: {
    color: theme.palette.warning,
  },
  statusBuilding: {
    color: '#29b6f6',
  },
  statusSuccess: {
    color: theme.palette.success,
  },
  statusFailed: {
    color: theme.palette.error,
  },
  statusIdle: {
    color: theme.palette.text.secondary,
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
  },
});

export default BuildScreenV2;
