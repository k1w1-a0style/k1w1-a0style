import React from 'react';
import { ActivityIndicator, Animated, Text, View } from 'react-native';
import { theme } from '../../../theme';
import type { PreviewDisplayState, PreviewPhase } from '../../../hooks/previewHelpers';
import { s } from '../PreviewScreen.styles';

type PreviewStatusBarProps = {
  phase: PreviewPhase;
  compact: boolean;
  runtimeHint: string | null;
  displayState: PreviewDisplayState;
  previewChannelLabel: string;
  previewExpiryText: string;
  transientLocalPreviewNotice: string | null;
  pulseAnim: Animated.Value;
  hotReloadEnabled: boolean;
  hotReloadCount: number;
  fileCount: number;
  totalSize: number;
  skippedCount: number;
};

export function getTransientPreviewNotice(notice: string | null): string | null {
  return typeof notice === 'string' && notice.trim().length > 0 ? notice : null;
}

export function PreviewStatusBar({
  phase,
  compact,
  runtimeHint,
  displayState,
  previewChannelLabel,
  previewExpiryText,
  transientLocalPreviewNotice,
  pulseAnim,
  hotReloadEnabled,
  hotReloadCount,
  fileCount,
  totalSize,
  skippedCount,
}: PreviewStatusBarProps) {
  const previewNotice = getTransientPreviewNotice(
    transientLocalPreviewNotice ?? displayState.detailText,
  );
  const isBusy = phase === 'creating' || phase === 'loading';
  const statusDotStyle =
    displayState.tone === 'ok'
      ? s.statusDotOk
      : displayState.tone === 'error'
        ? s.statusDotError
        : displayState.tone === 'warning'
          ? s.statusDotWarning
          : s.statusDotNeutral;
  const badgeStyle =
    displayState.tone === 'ok'
      ? s.statusBadgeOk
      : displayState.tone === 'error'
        ? s.statusBadgeError
        : displayState.tone === 'warning'
          ? s.statusBadgeWarning
          : s.statusBadgeNeutral;

  return (
    <View style={s.statusBarWrap}>
      <View style={[s.statusBar, compact && s.statusBarCompact]} testID="preview-status-bar">
        <View style={s.statusHeadline}>
          <View style={[s.statusDot, statusDotStyle, isBusy && s.statusDotLoading]} />
          <Text style={s.statusText} numberOfLines={compact ? 2 : 1}>
            {displayState.statusText}
          </Text>
          {isBusy && (
            <Animated.View style={{ opacity: pulseAnim }}>
              <ActivityIndicator size="small" color={theme.palette.primary} />
            </Animated.View>
          )}
        </View>
        <View style={[s.statusMetaRow, compact && s.statusMetaRowCompact]}>
          <Text style={s.previewStatsText} numberOfLines={1}>
            {fileCount} Dateien · {(totalSize / 1024).toFixed(1)} KB
            {skippedCount > 0 ? ` · ${skippedCount} übersprungen` : ""}
          </Text>
          {hotReloadEnabled && hotReloadCount > 0 && (
            <View style={s.hotBadge}>
              <Text style={s.hotBadgeText}>{hotReloadCount}x neu geladen</Text>
            </View>
          )}
          {displayState.badgeText && (
            <View style={[s.statusBadge, badgeStyle]}>
              <Text style={s.statusBadgeText}>{displayState.badgeText}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={[s.previewInfoBar, compact && s.previewInfoBarCompact]}>
        <Text style={s.previewInfoText} numberOfLines={compact ? 2 : 1}>{previewChannelLabel}</Text>
        <Text style={s.previewInfoBullet}>•</Text>
        <Text style={s.previewInfoText} numberOfLines={1}>{previewExpiryText}</Text>
      </View>
      {previewNotice && (
        <View style={s.previewNoticeBar}>
          <Text style={s.previewNoticeText} numberOfLines={compact ? 3 : 2}>{previewNotice}</Text>
        </View>
      )}
      {((typeof __DEV__ !== 'undefined' && __DEV__) || process.env.NODE_ENV === 'test') && runtimeHint ? (
        <View style={s.previewRuntimeBar}>
          <Text style={s.previewRuntimeText} numberOfLines={1}>{runtimeHint}</Text>
        </View>
      ) : null}
    </View>
  );
}
