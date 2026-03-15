// screens/PreviewScreen/PreviewScreen.tsx
// Refactored (Patch 200): Logik → usePreviewScreen, hier nur Rendering.

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { usePreviewScreen } from './hooks/usePreviewScreen';

import { s } from './PreviewScreen.styles';
import { DeviceFrame } from './components/DeviceFrame';
import { PreviewToolbar } from './components/PreviewToolbar';
import { PreviewStatusBar } from './components/PreviewStatusBar';

export default function PreviewScreen() {
  const {
    projectData,
    isLoading,
    state,
    lastPreview,
    previewSource,
    previewKind,
    previewUrl,
    previewExpiryText,
    previewChannelLabel,
    qrImageUrl,
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
    webViewRef,
    originWhitelist,
    handleShouldStartLoad,
    handleContentProcessDidTerminate,
    handleRenderProcessGone,
    resetRecoveryState,
    handleCreate,
    handleReset,
    handleCopy,
    handleCopyQrLink,
    handleOpenQr,
    handleOpenExternal,
    handleFullscreen,
  } = usePreviewScreen();

  const handleReload = () => {
    resetRecoveryState();
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
        hasQrUrl={Boolean(qrImageUrl)}
        onToggleHotReload={() => setHotReloadEnabled((value) => !value)}
        onReload={handleReload}
        onCopy={handleCopy}
        onOpenQr={handleOpenQr}
        onOpenExternal={handleOpenExternal}
        onFullscreen={handleFullscreen}
      />

      <PreviewStatusBar
        phase={phase}
        previewKind={previewKind}
        previewChannelLabel={previewChannelLabel}
        previewExpiryText={previewExpiryText}
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
        onLoadEnd={() => {
          resetRecoveryState();
          setPhase('ready');
        }}
        onError={(message) => {
          setPhase('error');
          setWebError(message);
        }}
        onHttpError={(statusCode) => {
          setPhase('error');
          setWebError(`HTTP ${statusCode ?? '?'}`);
        }}
        onContentProcessDidTerminate={handleContentProcessDidTerminate}
        onRenderProcessGone={handleRenderProcessGone}
        onCreate={handleCreate}
      />

      {previewUrl && (
        <View style={s.urlCard}>
          <View style={s.urlCardHeader}>
            <Ionicons name="link-outline" size={15} color={theme.palette.primary} />
            <Text style={s.urlCardTitle}>Preview-Link (Browser & QR)</Text>
          </View>
          <Text style={s.urlText} numberOfLines={2}>{previewUrl}</Text>
          <View style={s.urlActions}>
            <Pressable style={s.urlBtn} onPress={handleCopy}>
              <Ionicons name="copy-outline" size={14} color={theme.palette.text.primary} />
              <Text style={s.urlBtnText}>URL kopieren</Text>
            </Pressable>
            <Pressable style={s.urlBtn} onPress={handleOpenExternal}>
              <Ionicons name="open-outline" size={14} color={theme.palette.primary} />
              <Text style={[s.urlBtnText, s.urlBtnTextPrimary]}>Im Browser öffnen</Text>
            </Pressable>
            {qrImageUrl && (
              <Pressable style={s.urlBtn} onPress={handleOpenQr}>
                <Ionicons name="qr-code-outline" size={14} color={theme.palette.primary} />
                <Text style={[s.urlBtnText, s.urlBtnTextPrimary]}>QR anzeigen</Text>
              </Pressable>
            )}
            {qrImageUrl && (
              <Pressable style={s.urlBtn} onPress={handleCopyQrLink}>
                <Ionicons name="copy-outline" size={14} color={theme.palette.text.primary} />
                <Text style={s.urlBtnText}>QR-Link kopieren</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

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
