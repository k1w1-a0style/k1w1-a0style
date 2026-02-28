// screens/PreviewScreen/PreviewScreen.tsx
// Refactored (Patch 200): Logik → usePreviewScreen, hier nur Rendering.

import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { usePreviewScreen } from './hooks/usePreviewScreen';

import { s } from "./PreviewScreen.styles";

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
    originWhitelist,
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
          <Text style={s.loadingText}>Projekt wird geladen…</Text>
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
          <Text style={s.emptyText}>Öffne oder erstelle zuerst ein Projekt.</Text>
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
            <Text style={[s.hotReloadLabel, hotReloadEnabled && s.hotReloadLabelOn]}>Hot-Reload</Text>
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
            : phase === 'creating' ? 'Preview wird erstellt…'
            : phase === 'loading' ? 'Wird geladen…'
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
            <Text style={s.hotBadgeText}>{hotReloadCount}x neu geladen</Text>
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
                originWhitelist={originWhitelist}
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
                    {phase === 'creating' ? 'Preview wird generiert…' : 'Laden…'}
                  </Text>
                </View>
              )}
            </Animated.View>
          ) : (
            <View style={s.emptyPreview}>
              {phase === 'creating' ? (
                <>
                  <ActivityIndicator size="large" color={theme.palette.primary} />
                  <Text style={s.emptyPreviewText}>Preview wird erstellt…</Text>
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
            <Text style={s.errorRetryText}>Erneut versuchen</Text>
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
          <Text style={[s.bottomBtnText, { color: theme.palette.text.secondary }]}>Zurücksetzen</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

