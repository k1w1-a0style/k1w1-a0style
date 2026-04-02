import React from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../theme';
import { s } from '../PreviewScreen.styles';

type PreviewToolbarProps = {
  projectName: string;
  compact: boolean;
  runtimeHint: string | null;
  hotReloadEnabled: boolean;
  hotDotAnim: Animated.Value;
  hasPreviewUrl: boolean;
  hasQrUrl: boolean;
  canFullscreen: boolean;
  onToggleHotReload: () => void;
  onReload: () => void;
  onCopy: () => void;
  onOpenQr: () => void;
  onOpenExternal: () => void;
  onFullscreen: () => void;
};

export function PreviewToolbar({
  projectName,
  compact,
  runtimeHint,
  hotReloadEnabled,
  hotDotAnim,
  hasPreviewUrl,
  hasQrUrl,
  canFullscreen,
  onToggleHotReload,
  onReload,
  onCopy,
  onOpenQr,
  onOpenExternal,
  onFullscreen,
}: PreviewToolbarProps) {
  return (
    <View style={[s.toolbar, compact && s.toolbarCompact]}>
      <View style={[s.toolbarLeft, compact && s.toolbarLeftCompact]}>
        <Ionicons name="eye-outline" size={20} color={theme.palette.primary} />
        <View style={s.toolbarTitle}>
          <Text style={s.title} numberOfLines={1}>
            {compact ? 'Preview' : 'Browser Preview (Supabase bevorzugt)'}
          </Text>
          <Text style={s.subtitle} numberOfLines={1}>{projectName}</Text>
        </View>
      </View>
      <View style={[s.toolbarActions, compact && s.toolbarActionsCompact]} testID="preview-toolbar-actions">
        <Pressable
          style={[s.hotReloadBtn, hotReloadEnabled && s.hotReloadBtnOn]}
          onPress={onToggleHotReload}
          accessibilityLabel="Hot-Reload umschalten"
        >
          <Animated.View style={{ opacity: hotDotAnim }}>
            <View style={[s.hotDot, hotReloadEnabled && s.hotDotOn]} />
          </Animated.View>
          <Text style={[s.hotReloadLabel, hotReloadEnabled && s.hotReloadLabelOn]}>
            {compact ? 'Hot' : 'Hot-Reload'}
          </Text>
        </Pressable>
        <Pressable style={s.toolBtn} onPress={onReload} accessibilityLabel="Preview neu laden">
          <Ionicons name="refresh-outline" size={18} color={theme.palette.text.primary} />
        </Pressable>
        {hasPreviewUrl && (
          <Pressable style={s.toolBtn} onPress={onCopy} accessibilityLabel="Preview-Link kopieren">
            <Ionicons name="copy-outline" size={16} color={theme.palette.text.primary} />
          </Pressable>
        )}
        {hasQrUrl && (
          <Pressable style={s.toolBtn} onPress={onOpenQr} accessibilityLabel="QR-Vorschau öffnen">
            <Ionicons name="qr-code-outline" size={16} color={theme.palette.primary} />
          </Pressable>
        )}
        {hasPreviewUrl && (
          <Pressable style={s.toolBtn} onPress={onOpenExternal} accessibilityLabel="Preview im Browser öffnen">
            <Ionicons name="open-outline" size={16} color={theme.palette.primary} />
          </Pressable>
        )}
        <Pressable
          style={[s.toolBtn, !canFullscreen && { opacity: 0.45 }]}
          onPress={onFullscreen}
          disabled={!canFullscreen}
          accessibilityLabel="Preview fullscreen öffnen"
          accessibilityState={{ disabled: !canFullscreen }}
        >
          <Ionicons name="expand-outline" size={16} color={theme.palette.text.primary} />
        </Pressable>
      </View>
      {(typeof __DEV__ !== 'undefined' && __DEV__) || process.env.NODE_ENV === 'test' ? (
        <Text style={s.toolbarRuntimeHint} testID="preview-runtime-hint" numberOfLines={1}>
          {runtimeHint}
        </Text>
      ) : null}
    </View>
  );
}
