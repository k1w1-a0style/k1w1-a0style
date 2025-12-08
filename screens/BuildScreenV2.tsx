import React, { useState, useEffect } from 'react';
import {
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
  interpolate,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';

import { theme } from '../theme';
import { useBuildStatus } from '../hooks/useBuildStatus';
import { ensureSupabaseClient } from '../lib/supabase';
import { useGitHub } from '../contexts/GitHubContext';
import { getExpoToken } from '../contexts/ProjectContext';

const EAS_PROJECT_ID_STORAGE_KEY = 'eas_project_id';

// Create animated versions of components
const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedView = Animated.View;

const BuildScreenV2: React.FC = () => {
  const { activeRepo } = useGitHub();
  const [jobId, setJobId] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const { status, details, errorCount, lastError, isPolling } = useBuildStatus(
    jobId,
  );

  // Animation values
  const buttonScale = useSharedValue(1);
  const statusOpacity = useSharedValue(1);
  const statusScale = useSharedValue(1);
  const successPulse = useSharedValue(0);
  const errorShake = useSharedValue(0);

  // Animate status changes
  useEffect(() => {
    statusOpacity.value = withSequence(
      withTiming(0.5, { duration: 150 }),
      withTiming(1, { duration: 150 }),
    );
    statusScale.value = withSequence(
      withSpring(1.05, { damping: 10 }),
      withSpring(1, { damping: 10 }),
    );

    // Success pulse animation
    if (status === 'success') {
      successPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.ease }),
          withTiming(0, { duration: 800, easing: Easing.ease }),
        ),
        -1,
        false,
      );
    } else {
      successPulse.value = 0;
    }

    // Error shake animation
    if (status === 'failed' || status === 'error') {
      errorShake.value = withSequence(
        withTiming(-5, { duration: 50 }),
        withTiming(5, { duration: 50 }),
        withTiming(-5, { duration: 50 }),
        withTiming(5, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const statusAnimatedStyle = useAnimatedStyle(() => ({
    opacity: statusOpacity.value,
    transform: [{ scale: statusScale.value }],
  }));

  const successPulseStyle = useAnimatedStyle(() => {
    const opacity = interpolate(successPulse.value, [0, 1], [0.3, 0.8]);
    const scale = interpolate(successPulse.value, [0, 1], [1, 1.02]);
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  const errorShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: errorShake.value }],
  }));

  const handleButtonPressIn = () => {
    buttonScale.value = withSpring(0.95, { damping: 15 });
  };

  const handleButtonPressOut = () => {
    buttonScale.value = withSpring(1, { damping: 15 });
  };

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
      <AnimatedView entering={FadeIn.duration(400)}>
        <Text style={styles.title}>EAS Build</Text>
        <Text style={styles.subtitle}>
          Triggert einen EAS-Build über deine Supabase Edge Functions.
        </Text>
      </AnimatedView>

      <AnimatedView
        entering={FadeInDown.delay(100).duration(500).springify()}
        style={styles.card}
      >
        <Text style={styles.cardTitle}>Repository</Text>
        {activeRepo ? (
          <Text style={styles.cardText}>{activeRepo}</Text>
        ) : (
          <Text style={styles.warningText}>
            Kein aktives Repo gewählt. Wähle eines im GitHub-Screen aus.
          </Text>
        )}
      </AnimatedView>

      <AnimatedView
        entering={FadeInDown.delay(200).duration(500).springify()}
        style={styles.card}
      >
        <Text style={styles.cardTitle}>Build starten</Text>
        <Text style={styles.cardText}>
          Starte einen neuen EAS-Build für das aktive Repository. Der Status
          wird automatisch abgefragt.
        </Text>

        <AnimatedTouchableOpacity
          style={[
            styles.primaryButton,
            buttonAnimatedStyle,
            (!activeRepo || isStarting || isPolling) && styles.buttonDisabled,
          ]}
          onPress={startBuild}
          onPressIn={handleButtonPressIn}
          onPressOut={handleButtonPressOut}
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
        </AnimatedTouchableOpacity>

        {jobId && (
          <Animated.Text
            entering={FadeIn.duration(300)}
            style={styles.jobText}
          >
            Aktueller Job: #{jobId}
          </Animated.Text>
        )}
      </AnimatedView>

      <AnimatedView
        entering={FadeInDown.delay(300).duration(500).springify()}
        style={[
          styles.card,
          status === 'success' && styles.successCard,
          (status === 'failed' || status === 'error') && styles.errorCard,
        ]}
      >
        <Text style={styles.cardTitle}>Status</Text>
        <AnimatedView
          style={[
            statusAnimatedStyle,
            status === 'success' && successPulseStyle,
            (status === 'failed' || status === 'error') && errorShakeStyle,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              status === 'success' && styles.successText,
              (status === 'failed' || status === 'error') && styles.errorText,
              (status === 'building' || status === 'queued') &&
                styles.buildingText,
            ]}
          >
            {renderStatusText()}
          </Text>
        </AnimatedView>

        {details?.urls?.html && (
          <AnimatedTouchableOpacity
            entering={FadeIn.delay(100).duration(300)}
            style={styles.linkButton}
            onPress={() => openUrl(details.urls?.html)}
          >
            <Text style={styles.linkButtonText}>Build-Details aufrufen</Text>
          </AnimatedTouchableOpacity>
        )}

        {details?.urls?.artifacts && (
          <AnimatedTouchableOpacity
            entering={FadeIn.delay(200).duration(300)}
            style={styles.linkButton}
            onPress={() => openUrl(details.urls?.artifacts)}
          >
            <Text style={styles.linkButtonText}>Artifacts öffnen</Text>
          </AnimatedTouchableOpacity>
        )}

        {lastError && (
          <Animated.Text
            entering={FadeIn.duration(300)}
            style={styles.errorText}
          >
            Letzter Fehler ({errorCount}x): {lastError}
          </Animated.Text>
        )}
      </AnimatedView>
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
  successCard: {
    borderColor: theme.palette.success,
    backgroundColor: theme.palette.successSoft,
  },
  errorCard: {
    borderColor: theme.palette.error,
    backgroundColor: 'rgba(255,68,68,0.05)',
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
    fontWeight: '500',
  },
  successText: {
    color: theme.palette.success,
    fontSize: 14,
    fontWeight: '600',
  },
  buildingText: {
    color: theme.palette.text.accent,
    fontSize: 14,
  },
  warningText: {
    fontSize: 12,
    color: theme.palette.warning,
  },
  errorText: {
    fontSize: 12,
    color: theme.palette.error,
    marginTop: 8,
    fontWeight: '600',
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
