// screens/PreviewScreen/PreviewScreen.tsx
// Refactored (Patch 200): Logik → usePreviewScreen, hier nur Rendering.

import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { usePreviewScreen } from './hooks/usePreviewScreen';

export default function PreviewScreen() {
  const webViewRef = useRef<WebView>(null);

  const {
    projectData,
    isLoading,
    state,
    lastPreview,
    previewSource,
    phase,
    setPhase,
    webError,
    setWebError,
    hotReloadEnabled,
    setHotReloadEnabled,
    hotReloadCount,
    pulseAnim,
    fadeAnim,
    hotDotAnim,
    flashBorderAnim,
    handleShouldStartLoad,
    handleCreate,
    handleReset,
    handleCopy,
    handleOpenExternal,
    handleFullscreen,
  } = usePreviewScreen();

  const handleReload = () => {
    setWebError(null);
    if (webViewRef.current) {
      setPhase('loading');
      webViewRef.current.reload();
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.palette.primary} />
          <Text style={s.loadingText}>Projekt wird geladen...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!projectData) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <View style={s.center}>
          <Ionicons name="folder-open-outline" size={48} color={theme.palette.text.muted} />
          <Text style={s.emptyTitle}>Kein Projekt geladen</Text>
          <Text style={s.emptyText}>Oeffne oder erstelle zuerst ein Projekt.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Toolbar */}
      <View style={s.toolbar}>
        <View style={s.toolbarLeft}>
          <Ionicons name="eye-outline" size={20} color={theme.palette.primary} />
          <View style={s.toolbarTitle}>
            <Text style={s.title}>Live Preview</Text>
            <Text style={s.subtitle} numberOfLines={1}>{projectData.name}</Text>
          </View>
        </View>
        <View style={s.toolbarActions}>
          <Pressable
            style={[s.hotReloadBtn, hotReloadEnabled && s.hotReloadBtnOn]}
            onPress={() => setHotReloadEnabled((v) => !v)}
          >
            <Animated.View style={{ opacity: hotDotAnim }}>
              <View style={[s.hotDot, hotReloadEnabled && s.hotDotOn]} />
            </Animated.View>
            <Text style={[s.hotReloadLabel, hotReloadEnabled && s.hotReloadLabelOn]}>Hot</Text>
          </Pressable>
          <Pressable style={s.toolBtn} onPress={handleReload}>
            <Ionicons name="refresh-outline" size={18} color={theme.palette.text.primary} />
          </Pressable>
          {lastPreview?.url && (
            <Pressable style={s.toolBtn} onPress={handleCopy}>
              <Ionicons name="copy-outline" size={16} color={theme.palette.text.primary} />
            </Pressable>
          )}
          {lastPreview?.url && (
            <Pressable style={s.toolBtn} onPress={handleOpenExternal}>
              <Ionicons name="open-outline" size={16} color={theme.palette.primary} />
            </Pressable>
          )}
          <Pressable style={s.toolBtn} onPress={handleFullscreen}>
            <Ionicons name="expand-outline" size={16} color={theme.palette.text.primary} />
          </Pressable>
        </View>
      </View>

      {/* Status Bar */}
      <View style={s.statusBar}>
        <View style={[
          s.statusDot,
          phase === 'ready' && s.statusDotOk,
          phase === 'error' && s.statusDotError,
          (phase === 'creating' || phase === 'loading') && s.statusDotLoading,
        ]} />
        <Text style={s.statusText}>
          {phase === 'idle' ? 'Bereit'
            : phase === 'creating' ? 'Preview wird erstellt...'
            : phase === 'loading' ? 'Wird geladen...'
            : phase === 'ready' ? 'Live'
            : 'Fehler'}
        </Text>
        {(phase === 'creating' || phase === 'loading') && (
          <Animated.View style={{ opacity: pulseAnim }}>
            <ActivityIndicator size="small" color={theme.palette.primary} />
          </Animated.View>
        )}
        {hotReloadEnabled && hotReloadCount > 0 && (
          <View style={s.hotBadge}>
            <Text style={s.hotBadgeText}>{hotReloadCount}x reloaded</Text>
          </View>
        )}
      </View>

      {/* Device Frame */}
      <View style={s.previewArea}>
        <Animated.View style={[
          s.deviceFrame,
          {
            borderColor: flashBorderAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [theme.palette.border, theme.palette.primary, theme.palette.primary],
            }),
            shadowOpacity: flashBorderAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.9] }),
            shadowColor: flashBorderAnim.interpolate({ inputRange: [0, 1], outputRange: ['#000', theme.palette.primary] }),
            shadowRadius: flashBorderAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 24] }),
          },
        ]}>
          <View style={s.deviceNotch} />

          {previewSource ? (
            <Animated.View style={[s.webViewWrap, { opacity: phase === 'ready' ? fadeAnim : 0.3 }]}>
              <WebView
                ref={webViewRef}
                style={s.webView}
                source={previewSource.type === 'url' ? { uri: previewSource.uri } : { html: previewSource.html }}
                originWhitelist={['https://*', 'http://*', 'data:*', 'about:*', 'blob:*']}
                setSupportMultipleWindows={false}
                javaScriptCanOpenWindowsAutomatically={false}
                onShouldStartLoadWithRequest={handleShouldStartLoad}
                onLoadStart={() => { setPhase('loading'); setWebError(null); }}
                onLoadEnd={() => setPhase('ready')}
                onError={(e) => { setPhase('error'); setWebError(e.nativeEvent?.description || 'WebView Fehler'); }}
                onHttpError={(e) => { setPhase('error'); setWebError(`HTTP ${e.nativeEvent?.statusCode || '?'}`); }}
                mixedContentMode="always"
                startInLoadingState={false}
              />
              {(phase === 'loading' || phase === 'creating') && (
                <View style={s.loadingOverlay}>
                  <ActivityIndicator size="large" color={theme.palette.primary} />
                  <Text style={s.loadingOverlayText}>
                    {phase === 'creating' ? 'Preview wird generiert...' : 'Laden...'}
                  </Text>
                </View>
              )}
            </Animated.View>
          ) : (
            <View style={s.emptyPreview}>
              {phase === 'creating' ? (
                <>
                  <ActivityIndicator size="large" color={theme.palette.primary} />
                  <Text style={s.emptyPreviewText}>Preview wird erstellt...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="phone-portrait-outline" size={48} color={theme.palette.text.muted} />
                  <Text style={s.emptyPreviewText}>Noch keine Preview</Text>
                  <Pressable style={s.createBtn} onPress={handleCreate}>
                    <Ionicons name="play-outline" size={16} color={theme.palette.primary} />
                    <Text style={s.createBtnText}>Preview erstellen</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}

          <View style={s.deviceBottom} />
        </Animated.View>
      </View>

      {/* Error Bar */}
      {(webError || state.error) && (
        <View style={s.errorBar}>
          <Ionicons name="alert-circle" size={16} color={theme.palette.error} />
          <Text style={s.errorText} numberOfLines={2}>{webError || state.error}</Text>
          <Pressable style={s.errorRetryBtn} onPress={handleCreate}>
            <Text style={s.errorRetryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Bottom Bar */}
      <View style={s.bottomBar}>
        <Pressable style={[s.bottomBtn, state.isCreating && s.disabled]} onPress={handleCreate} disabled={state.isCreating}>
          <Ionicons name="refresh-outline" size={16} color={theme.palette.primary} />
          <Text style={s.bottomBtnText}>Neu erstellen</Text>
        </Pressable>
        <Pressable style={s.bottomBtn} onPress={handleReset}>
          <Ionicons name="trash-outline" size={16} color={theme.palette.text.secondary} />
          <Text style={[s.bottomBtnText, { color: theme.palette.text.secondary }]}>Zuruecksetzen</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.palette.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  loadingText: { color: theme.palette.text.secondary, fontWeight: '700', fontSize: 14 },
  emptyTitle: { color: theme.palette.text.primary, fontSize: 18, fontWeight: '900' },
  emptyText: { color: theme.palette.text.secondary, fontSize: 14, textAlign: 'center' },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  toolbarTitle: { flex: 1, minWidth: 0 },
  title: { color: theme.palette.text.primary, fontSize: 18, fontWeight: '900' },
  subtitle: { color: theme.palette.text.secondary, fontSize: 12 },
  toolbarActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  toolBtn: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1,
    borderColor: theme.palette.border, backgroundColor: theme.palette.background,
    alignItems: 'center', justifyContent: 'center',
  },
  hotReloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1,
    borderColor: theme.palette.border, backgroundColor: theme.palette.background,
  },
  hotReloadBtnOn: { borderColor: theme.palette.primary, backgroundColor: 'rgba(0,255,0,0.06)' },
  hotDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.palette.text.disabled },
  hotDotOn: {
    backgroundColor: theme.palette.primary,
    shadowColor: theme.palette.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 4,
  },
  hotReloadLabel: { fontSize: 11, fontWeight: '900', color: theme.palette.text.muted, letterSpacing: 0.3 },
  hotReloadLabelOn: { color: theme.palette.primary },
  statusBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: theme.palette.backgroundDark,
    borderBottomWidth: 1, borderBottomColor: theme.palette.border,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.palette.text.disabled },
  statusDotOk: {
    backgroundColor: theme.palette.success,
    shadowColor: theme.palette.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 4,
  },
  statusDotError: { backgroundColor: theme.palette.error },
  statusDotLoading: { backgroundColor: theme.palette.warning },
  statusText: { flex: 1, color: theme.palette.text.secondary, fontSize: 12, fontWeight: '700' },
  hotBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1,
    borderColor: 'rgba(0,255,0,0.2)', backgroundColor: 'rgba(0,255,0,0.06)',
  },
  hotBadgeText: { color: theme.palette.primary, fontSize: 10, fontWeight: '800' },
  previewArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 16, backgroundColor: theme.palette.backgroundDark,
  },
  deviceFrame: {
    flex: 1, width: '100%', maxWidth: 400,
    backgroundColor: '#111', borderRadius: 24, borderWidth: 2,
    borderColor: theme.palette.border, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  deviceNotch: {
    height: 6, backgroundColor: '#0a0a0a',
    borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
    marginHorizontal: '30%', marginBottom: 2,
  },
  deviceBottom: {
    height: 4, backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 8, borderTopRightRadius: 8,
    marginHorizontal: '40%', marginTop: 2,
  },
  webViewWrap: { flex: 1 },
  webView: { flex: 1, backgroundColor: '#fff' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  loadingOverlayText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  emptyPreview: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  emptyPreviewText: { color: theme.palette.text.muted, fontSize: 14, fontWeight: '700' },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1.5, borderColor: theme.palette.primary,
  },
  createBtnText: { color: theme.palette.primary, fontSize: 14, fontWeight: '800' },
  errorBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: 'rgba(255,68,68,0.08)',
    borderTopWidth: 1, borderTopColor: theme.palette.error,
  },
  errorText: { flex: 1, color: theme.palette.error, fontSize: 12, fontWeight: '600' },
  errorRetryBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: theme.palette.error,
  },
  errorRetryText: { color: theme.palette.error, fontSize: 12, fontWeight: '800' },
  bottomBar: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  bottomBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
    borderColor: theme.palette.border, backgroundColor: 'transparent',
  },
  bottomBtnText: { color: theme.palette.primary, fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.5 },
});
