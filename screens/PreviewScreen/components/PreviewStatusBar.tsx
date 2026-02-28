import React from 'react';
import { ActivityIndicator, Animated, Text, View } from 'react-native';
import { theme } from '../../../theme';
import type { PreviewPhase } from '../hooks/usePreviewScreen';
import { s } from '../PreviewScreen.styles';

type PreviewStatusBarProps = {
  phase: PreviewPhase;
  pulseAnim: Animated.Value;
  hotReloadEnabled: boolean;
  hotReloadCount: number;
};

function getStatusText(phase: PreviewPhase): string {
  if (phase === 'idle') return 'Bereit';
  if (phase === 'creating') return 'Preview wird erstellt…';
  if (phase === 'loading') return 'Wird geladen…';
  if (phase === 'ready') return 'Live';
  return 'Fehler';
}

export function PreviewStatusBar({ phase, pulseAnim, hotReloadEnabled, hotReloadCount }: PreviewStatusBarProps) {
  return (
    <View style={s.statusBar}>
      <View
        style={[
          s.statusDot,
          phase === 'ready' && s.statusDotOk,
          phase === 'error' && s.statusDotError,
          (phase === 'creating' || phase === 'loading') && s.statusDotLoading,
        ]}
      />
      <Text style={s.statusText}>{getStatusText(phase)}</Text>
      {(phase === 'creating' || phase === 'loading') && (
        <Animated.View style={{ opacity: pulseAnim }}>
          <ActivityIndicator size="small" color={theme.palette.primary} />
        </Animated.View>
      )}
      {hotReloadEnabled && hotReloadCount > 0 && (
        <View style={s.hotBadge}>
          <Text style={s.hotBadgeText}>{hotReloadCount}x neu geladen</Text>
        </View>
      )}
    </View>
  );
}
