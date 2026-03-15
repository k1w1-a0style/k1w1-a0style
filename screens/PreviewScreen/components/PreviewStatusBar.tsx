import React from 'react';
import { ActivityIndicator, Animated, Text, View } from 'react-native';
import { theme } from '../../../theme';
import type { PreviewPhase } from '../hooks/usePreviewScreen';
import { s } from '../PreviewScreen.styles';

type PreviewStatusBarProps = {
  phase: PreviewPhase;
  previewKind: "supabase" | "local" | null;
  previewChannelLabel: string;
  previewExpiryText: string;
  pulseAnim: Animated.Value;
  hotReloadEnabled: boolean;
  hotReloadCount: number;
  fileCount: number;
  totalSize: number;
  skippedCount: number;
};

export function getStatusText(phase: PreviewPhase, previewKind: "supabase" | "local" | null): string {
  if (phase === 'idle') return 'Bereit für Preview-Erstellung';
  if (phase === 'creating') return 'Preview wird erstellt…';
  if (phase === 'loading') return 'Preview wird geladen…';
  if (phase === 'ready') return previewKind === 'local' ? 'Fallback aktiv (letzter bekannter Stand)' : 'Live-Preview aktiv (Supabase)';
  return 'Preview-Fehler';
}

export function PreviewStatusBar({
  phase,
  previewKind,
  previewChannelLabel,
  previewExpiryText,
  pulseAnim,
  hotReloadEnabled,
  hotReloadCount,
  fileCount,
  totalSize,
  skippedCount,
}: PreviewStatusBarProps) {
  return (
    <View style={s.statusBarWrap}>
      <View style={s.statusBar}>
        <View
          style={[
            s.statusDot,
            phase === 'ready' && s.statusDotOk,
            phase === 'error' && s.statusDotError,
            (phase === 'creating' || phase === 'loading') && s.statusDotLoading,
          ]}
        />
        <Text style={s.statusText}>{getStatusText(phase, previewKind)}</Text>
        {(phase === 'creating' || phase === 'loading') && (
          <Animated.View style={{ opacity: pulseAnim }}>
            <ActivityIndicator size="small" color={theme.palette.primary} />
          </Animated.View>
        )}
        <Text style={s.previewStatsText}>
          {fileCount} Dateien · {(totalSize / 1024).toFixed(1)} KB
          {skippedCount > 0 ? ` · ${skippedCount} übersprungen` : ""}
        </Text>
        {hotReloadEnabled && hotReloadCount > 0 && (
          <View style={s.hotBadge}>
            <Text style={s.hotBadgeText}>{hotReloadCount}x neu geladen</Text>
          </View>
        )}

        {phase === 'ready' && previewKind === 'local' && (
          <View style={s.hotBadge}>
            <Text style={s.hotBadgeText}>Fallback aktiv</Text>
          </View>
        )}
      </View>

      <View style={s.previewInfoBar}>
        <Text style={s.previewInfoText}>{previewChannelLabel}</Text>
        <Text style={s.previewInfoText}>•</Text>
        <Text style={s.previewInfoText}>{previewExpiryText}</Text>
      </View>
    </View>
  );
}
