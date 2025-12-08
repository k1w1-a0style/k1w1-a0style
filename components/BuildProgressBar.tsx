// components/BuildProgressBar.tsx
// Animierte Progress-Bar für Build-Status

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { theme } from '../theme';
import { BuildPhase } from '../contexts/types';

interface BuildProgressBarProps {
  progress: number; // 0-100
  phase: BuildPhase;
  showPercentage?: boolean;
  showPhaseLabel?: boolean;
  height?: number;
}

const BuildProgressBar: React.FC<BuildProgressBarProps> = ({
  progress,
  phase,
  showPercentage = true,
  showPhaseLabel = true,
  height = 8,
}) => {
  const progressAnim = useSharedValue(0);
  const pulseAnim = useSharedValue(0);
  const shimmerAnim = useSharedValue(0);

  // Progress Animation
  useEffect(() => {
    progressAnim.value = withSpring(progress, {
      damping: 15,
      stiffness: 100,
    });
  }, [progress, progressAnim]);

  // Pulse Animation für aktive Phasen
  useEffect(() => {
    const isActive = ['queued', 'checkout', 'setup', 'install', 'building', 'uploading'].includes(phase);

    if (isActive) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.ease }),
          withTiming(0, { duration: 800, easing: Easing.ease })
        ),
        -1,
        false
      );

      // Shimmer Effekt
      shimmerAnim.value = withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      pulseAnim.value = 0;
      shimmerAnim.value = 0;
    }
  }, [phase, pulseAnim, shimmerAnim]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value}%`,
  }));

  const pulseStyle = useAnimatedStyle(() => {
    const opacity = interpolate(pulseAnim.value, [0, 1], [1, 0.7]);
    return { opacity };
  });

  const shimmerStyle = useAnimatedStyle(() => {
    const translateX = interpolate(shimmerAnim.value, [0, 1], [-100, 200]);
    return {
      transform: [{ translateX }],
    };
  });

  const getPhaseColor = (): string => {
    switch (phase) {
      case 'success':
        return theme.palette.success;
      case 'failed':
      case 'error':
        return theme.palette.error;
      case 'queued':
        return theme.palette.warning;
      default:
        return theme.palette.primary;
    }
  };

  const getPhaseLabel = (): string => {
    switch (phase) {
      case 'idle':
        return 'Bereit';
      case 'queued':
        return 'In Warteschlange';
      case 'checkout':
        return 'Repository wird geladen...';
      case 'setup':
        return 'Umgebung wird eingerichtet...';
      case 'install':
        return 'Abhängigkeiten werden installiert...';
      case 'building':
        return 'Build läuft...';
      case 'uploading':
        return 'Artefakte werden hochgeladen...';
      case 'success':
        return 'Build erfolgreich!';
      case 'failed':
        return 'Build fehlgeschlagen';
      case 'error':
        return 'Fehler aufgetreten';
      default:
        return phase;
    }
  };

  const phaseColor = getPhaseColor();
  const isActive = !['idle', 'success', 'failed', 'error'].includes(phase);

  return (
    <View style={styles.container}>
      {/* Labels */}
      <View style={styles.labelRow}>
        {showPhaseLabel && (
          <Text style={[styles.phaseLabel, { color: phaseColor }]}>
            {getPhaseLabel()}
          </Text>
        )}
        {showPercentage && (
          <Text style={styles.percentageLabel}>{Math.round(progress)}%</Text>
        )}
      </View>

      {/* Progress Bar */}
      <View style={[styles.trackContainer, { height }]}>
        <View style={[styles.track, { height }]}>
          <Animated.View
            style={[
              styles.progress,
              { backgroundColor: phaseColor, height },
              progressBarStyle,
              isActive && pulseStyle,
            ]}
          >
            {/* Shimmer Effect */}
            {isActive && (
              <Animated.View style={[styles.shimmer, shimmerStyle]} />
            )}
          </Animated.View>
        </View>
      </View>

      {/* Phase Indicators */}
      <View style={styles.phaseIndicators}>
        <PhaseIndicator
          label="Queue"
          isActive={phase === 'queued'}
          isCompleted={['checkout', 'setup', 'install', 'building', 'uploading', 'success'].includes(phase)}
        />
        <PhaseIndicator
          label="Setup"
          isActive={['checkout', 'setup'].includes(phase)}
          isCompleted={['install', 'building', 'uploading', 'success'].includes(phase)}
        />
        <PhaseIndicator
          label="Install"
          isActive={phase === 'install'}
          isCompleted={['building', 'uploading', 'success'].includes(phase)}
        />
        <PhaseIndicator
          label="Build"
          isActive={phase === 'building'}
          isCompleted={['uploading', 'success'].includes(phase)}
        />
        <PhaseIndicator
          label="Fertig"
          isActive={phase === 'uploading'}
          isCompleted={phase === 'success'}
        />
      </View>
    </View>
  );
};

interface PhaseIndicatorProps {
  label: string;
  isActive: boolean;
  isCompleted: boolean;
}

const PhaseIndicator: React.FC<PhaseIndicatorProps> = ({
  label,
  isActive,
  isCompleted,
}) => {
  return (
    <View style={styles.phaseIndicator}>
      <View
        style={[
          styles.phaseDot,
          isCompleted && styles.phaseDotCompleted,
          isActive && styles.phaseDotActive,
        ]}
      />
      <Text
        style={[
          styles.phaseIndicatorLabel,
          isCompleted && styles.phaseIndicatorLabelCompleted,
          isActive && styles.phaseIndicatorLabelActive,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phaseLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  percentageLabel: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    fontWeight: '600',
  },
  trackContainer: {
    borderRadius: 4,
    overflow: 'hidden',
  },
  track: {
    backgroundColor: theme.palette.secondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progress: {
    borderRadius: 4,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 100,
    backgroundColor: 'rgba(255,255,255,0.2)',
    transform: [{ skewX: '-20deg' }],
  },
  phaseIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  phaseIndicator: {
    alignItems: 'center',
    gap: 4,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.palette.border,
  },
  phaseDotCompleted: {
    backgroundColor: theme.palette.success,
  },
  phaseDotActive: {
    backgroundColor: theme.palette.primary,
  },
  phaseIndicatorLabel: {
    fontSize: 9,
    color: theme.palette.text.muted,
  },
  phaseIndicatorLabelCompleted: {
    color: theme.palette.success,
  },
  phaseIndicatorLabelActive: {
    color: theme.palette.primary,
    fontWeight: '600',
  },
});

export default BuildProgressBar;
