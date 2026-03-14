// screens/PreviewScreen/PreviewScreen.tsx
// Refactored (Patch 200): Logik → usePreviewScreen, hier nur Rendering.

import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { usePreviewScreen } from './hooks/usePreviewScreen';

import { s } from './PreviewScreen.styles';
import { DeviceFrame } from './components/DeviceFrame';
import { PreviewToolbar } from './components/PreviewToolbar';
import { PreviewStatusBar } from './components/PreviewStatusBar';

export default function PreviewScreen() {
  const webViewRef = useRef<WebView>(null);

  const {
    projectData,
    isLoading,
    state,
    lastPreview,
    previewSource,
    previewKind,
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
      <PreviewToolbar
        projectName={projectData.name}
        hotReloadEnabled={hotReloadEnabled}
        hotDotAnim={hotDotAnim}
        hasPreviewUrl={Boolean(lastPreview?.url)}
        onToggleHotReload={() => setHotReloadEnabled((value) => !value)}
        onReload={handleReload}
        onCopy={handleCopy}
        onOpenExternal={handleOpenExternal}
        onFullscreen={handleFullscreen}
      />

      <PreviewStatusBar
        phase={phase}
        previewKind={previewKind}
        pulseAnim={pulseAnim}
        hotReloadEnabled={hotReloadEnabled}
        hotReloadCount={hotReloadCount}
        fileCount={state.fileCount}
        totalSize={state.totalSize}
        skippedCount={state.skippedCount}
      />

      <DeviceFrame
        webViewRef={webViewRef}
        previewSource={previewSource}
        phase={phase}
        fadeAnim={fadeAnim}
        flashBorderAnim={flashBorderAnim}
        originWhitelist={originWhitelist}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onLoadStart={() => {
          setPhase('loading');
          setWebError(null);
        }}
        onLoadEnd={() => setPhase('ready')}
        onError={(message) => {
          setPhase('error');
          setWebError(message);
        }}
        onHttpError={(statusCode) => {
          setPhase('error');
          setWebError(`HTTP ${statusCode ?? '?'}`);
        }}
        onCreate={handleCreate}
      />

      {(webError || state.error) && (
        <View style={s.errorBar}>
          <Ionicons name="alert-circle" size={16} color={theme.palette.error} />
          <Text style={s.errorText} numberOfLines={2}>{webError || state.error}</Text>
          <Pressable style={s.errorRetryBtn} onPress={handleCreate}>
            <Text style={s.errorRetryText}>Erneut versuchen</Text>
          </Pressable>
        </View>
      )}

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
