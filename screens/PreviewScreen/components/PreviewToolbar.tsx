import React from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../theme';
import { s } from '../PreviewScreen.styles';

type PreviewToolbarProps = {
  projectName: string;
  hotReloadEnabled: boolean;
  hotDotAnim: Animated.Value;
  hasPreviewUrl: boolean;
  hasQrUrl: boolean;
  onToggleHotReload: () => void;
  onReload: () => void;
  onCopy: () => void;
  onOpenQr: () => void;
  onOpenExternal: () => void;
  onFullscreen: () => void;
};

export function PreviewToolbar({
  projectName,
  hotReloadEnabled,
  hotDotAnim,
  hasPreviewUrl,
  hasQrUrl,
  onToggleHotReload,
  onReload,
  onCopy,
  onOpenQr,
  onOpenExternal,
  onFullscreen,
}: PreviewToolbarProps) {
  return (
    <View style={s.toolbar}>
      <View style={s.toolbarLeft}>
        <Ionicons name="eye-outline" size={20} color={theme.palette.primary} />
        <View style={s.toolbarTitle}>
          <Text style={s.title}>Browser Preview (Supabase bevorzugt)</Text>
          <Text style={s.subtitle} numberOfLines={1}>{projectName}</Text>
        </View>
      </View>
      <View style={s.toolbarActions}>
        <Pressable
          style={[s.hotReloadBtn, hotReloadEnabled && s.hotReloadBtnOn]}
          onPress={onToggleHotReload}
        >
          <Animated.View style={{ opacity: hotDotAnim }}>
            <View style={[s.hotDot, hotReloadEnabled && s.hotDotOn]} />
          </Animated.View>
          <Text style={[s.hotReloadLabel, hotReloadEnabled && s.hotReloadLabelOn]}>Hot-Reload</Text>
        </Pressable>
        <Pressable style={s.toolBtn} onPress={onReload}>
          <Ionicons name="refresh-outline" size={18} color={theme.palette.text.primary} />
        </Pressable>
        {hasPreviewUrl && (
          <Pressable style={s.toolBtn} onPress={onCopy}>
            <Ionicons name="copy-outline" size={16} color={theme.palette.text.primary} />
          </Pressable>
        )}
        {hasQrUrl && (
          <Pressable style={s.toolBtn} onPress={onOpenQr}>
            <Ionicons name="qr-code-outline" size={16} color={theme.palette.primary} />
          </Pressable>
        )}
        {hasPreviewUrl && (
          <Pressable style={s.toolBtn} onPress={onOpenExternal}>
            <Ionicons name="open-outline" size={16} color={theme.palette.primary} />
          </Pressable>
        )}
        <Pressable style={s.toolBtn} onPress={onFullscreen}>
          <Ionicons name="expand-outline" size={16} color={theme.palette.text.primary} />
        </Pressable>
      </View>
    </View>
  );
}
