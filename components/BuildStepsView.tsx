// components/BuildStepsView.tsx
// Visualisierung der Build-Steps wie auf GitHub Actions

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { theme } from '../theme';
import { BuildStepInfo } from '../contexts/types';

interface BuildStepsViewProps {
  steps: BuildStepInfo[];
  onStepPress?: (step: BuildStepInfo) => void;
  compact?: boolean;
}

const AnimatedView = Animated.View;

const BuildStepsView: React.FC<BuildStepsViewProps> = ({
  steps,
  onStepPress,
  compact = false,
}) => {
  if (steps.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Keine Steps gefunden</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {steps.map((step, index) => (
        <StepItem
          key={`${step.name}-${index}`}
          step={step}
          index={index}
          isLast={index === steps.length - 1}
          compact={compact}
          onPress={onStepPress ? () => onStepPress(step) : undefined}
        />
      ))}
    </View>
  );
};

interface StepItemProps {
  step: BuildStepInfo;
  index: number;
  isLast: boolean;
  compact: boolean;
  onPress?: () => void;
}

const StepItem: React.FC<StepItemProps> = ({
  step,
  index,
  isLast,
  compact,
  onPress,
}) => {
  // Animation für laufende Steps
  const pulseAnim = useSharedValue(1);

  React.useEffect(() => {
    if (step.status === 'running') {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 500, easing: Easing.ease }),
          withTiming(1, { duration: 500, easing: Easing.ease })
        ),
        -1,
        false
      );
    } else {
      pulseAnim.value = 1;
    }
  }, [step.status, pulseAnim]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseAnim.value,
  }));

  const getStatusIcon = () => {
    switch (step.status) {
      case 'success':
        return (
          <View style={[styles.statusIcon, styles.statusSuccess]}>
            <Ionicons name="checkmark" size={12} color={theme.palette.background} />
          </View>
        );
      case 'failed':
        return (
          <View style={[styles.statusIcon, styles.statusFailed]}>
            <Ionicons name="close" size={12} color="#fff" />
          </View>
        );
      case 'running':
        return (
          <AnimatedView style={[styles.statusIcon, styles.statusRunning, pulseStyle]}>
            <Ionicons name="play" size={10} color={theme.palette.background} />
          </AnimatedView>
        );
      case 'skipped':
        return (
          <View style={[styles.statusIcon, styles.statusSkipped]}>
            <Ionicons name="arrow-forward" size={10} color={theme.palette.text.muted} />
          </View>
        );
      default:
        return (
          <View style={[styles.statusIcon, styles.statusPending]}>
            <View style={styles.pendingDot} />
          </View>
        );
    }
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const Container = onPress ? TouchableOpacity : View;

  return (
    <AnimatedView
      entering={FadeInDown.delay(index * 50).duration(300)}
    >
      <Container
        style={[styles.stepContainer, compact && styles.stepContainerCompact]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {/* Connector Line (nicht für letzten Step) */}
        {!isLast && (
          <View style={styles.connectorContainer}>
            <View
              style={[
                styles.connector,
                step.status === 'success' && styles.connectorSuccess,
                step.status === 'failed' && styles.connectorFailed,
                step.status === 'running' && styles.connectorRunning,
              ]}
            />
          </View>
        )}

        {/* Status Icon */}
        {getStatusIcon()}

        {/* Step Info */}
        <View style={styles.stepInfo}>
          <Text
            style={[
              styles.stepName,
              step.status === 'skipped' && styles.stepNameSkipped,
              step.status === 'failed' && styles.stepNameFailed,
              step.status === 'running' && styles.stepNameRunning,
            ]}
            numberOfLines={compact ? 1 : 2}
          >
            {step.name}
          </Text>

          {!compact && step.duration !== undefined && (
            <Text style={styles.stepDuration}>
              {formatDuration(step.duration)}
            </Text>
          )}
        </View>

        {/* Duration Badge (compact mode) */}
        {compact && step.duration !== undefined && (
          <Text style={styles.stepDurationBadge}>
            {formatDuration(step.duration)}
          </Text>
        )}

        {/* Running indicator */}
        {step.status === 'running' && (
          <AnimatedView style={[styles.runningIndicator, pulseStyle]}>
            <Text style={styles.runningText}>Läuft...</Text>
          </AnimatedView>
        )}
      </Container>
    </AnimatedView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 0,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: theme.palette.text.muted,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    position: 'relative',
  },
  stepContainerCompact: {
    paddingVertical: 6,
  },
  connectorContainer: {
    position: 'absolute',
    left: 22,
    top: 28,
    bottom: -2,
    width: 2,
  },
  connector: {
    flex: 1,
    backgroundColor: theme.palette.border,
    borderRadius: 1,
  },
  connectorSuccess: {
    backgroundColor: theme.palette.success,
  },
  connectorFailed: {
    backgroundColor: theme.palette.error,
  },
  connectorRunning: {
    backgroundColor: theme.palette.primary,
  },
  statusIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  statusSuccess: {
    backgroundColor: theme.palette.success,
  },
  statusFailed: {
    backgroundColor: theme.palette.error,
  },
  statusRunning: {
    backgroundColor: theme.palette.primary,
  },
  statusSkipped: {
    backgroundColor: theme.palette.secondary,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  statusPending: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: theme.palette.border,
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.text.muted,
  },
  stepInfo: {
    flex: 1,
    marginRight: 8,
  },
  stepName: {
    fontSize: 13,
    color: theme.palette.text.primary,
    fontWeight: '500',
    lineHeight: 18,
  },
  stepNameSkipped: {
    color: theme.palette.text.muted,
    textDecorationLine: 'line-through',
  },
  stepNameFailed: {
    color: theme.palette.error,
  },
  stepNameRunning: {
    color: theme.palette.primary,
    fontWeight: '600',
  },
  stepDuration: {
    fontSize: 11,
    color: theme.palette.text.muted,
    marginTop: 2,
  },
  stepDurationBadge: {
    fontSize: 10,
    color: theme.palette.text.muted,
    backgroundColor: theme.palette.secondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  runningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  runningText: {
    fontSize: 10,
    color: theme.palette.primary,
    fontWeight: '600',
  },
});

export default BuildStepsView;
