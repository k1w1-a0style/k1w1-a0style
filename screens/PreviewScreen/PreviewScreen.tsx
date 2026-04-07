// screens/PreviewScreen/PreviewScreen.tsx
// Refactored (Patch 200): Logik → usePreviewScreen, hier nur Rendering.

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { usePreviewScreen } from './hooks/usePreviewScreen';

import { s } from './PreviewScreen.styles';
import { DeviceFrame } from './components/DeviceFrame';
import { PreviewToolbar } from './components/PreviewToolbar';
import { PreviewStatusBar } from './components/PreviewStatusBar';

export default function PreviewScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompactLayout = width < 420;
  const isShortLayout = height < 760;
  const {
    projectData,
    isLoading,
    state,
    previewSource,
    previewUrl,
    previewUrlDisplay,
    previewExpiryText,
    canOpenFullscreen,
    previewChannelLabel,
    transientLocalPreviewNotice,
    displayState,
    runtimeHint,
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
      <View testID="preview-toolbar">
        <PreviewToolbar
          projectName={projectData.name}
          compact={isCompactLayout}
          runtimeHint={runtimeHint}
          hotReloadEnabled={hotReloadEnabled}
          hotDotAnim={hotDotAnim}
          hasPreviewUrl={Boolean(previewUrl)}
          hasQrUrl={Boolean(qrImageUrl)}
          canFullscreen={canOpenFullscreen}
          onToggleHotReload={() => setHotReloadEnabled((value) => !value)}
          onReload={handleReload}
          onCopy={handleCopy}
          onOpenQr={handleOpenQr}
          onOpenExternal={handleOpenExternal}
          onFullscreen={handleFullscreen}
        />
      </View>

      <ScrollView
        style={s.screenContent}
        contentContainerStyle={[
          s.screenScrollContent,
          isShortLayout && s.screenScrollContentShort,
        ]}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={isShortLayout}
        testID="preview-screen-scroll"
      >
        <View style={s.screenScrollInner} testID="preview-screen-active-path">
          <PreviewStatusBar
            phase={phase}
            compact={isCompactLayout}
            runtimeHint={runtimeHint}
            displayState={displayState}
            previewChannelLabel={previewChannelLabel}
            previewExpiryText={previewExpiryText}
            transientLocalPreviewNotice={transientLocalPreviewNotice}
            pulseAnim={pulseAnim}
            hotReloadEnabled={hotReloadEnabled}
            hotReloadCount={hotReloadCount}
            fileCount={state.fileCount}
            totalSize={state.totalSize}
            skippedCount={state.skippedCount}
          />

          <View
            style={[s.previewBody, isShortLayout && s.previewBodyShort]}
            testID="preview-screen-main-content"
          >
            <DeviceFrame
              webViewRef={webViewRef}
              previewSource={previewSource}
              phase={phase}
              fadeAnim={fadeAnim}
              flashBorderAnim={flashBorderAnim}
              originWhitelist={originWhitelist}
              errorMessage={webError || state.error || state.remoteFailure}
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

            {(previewUrl || webError || state.error || state.remoteFailure) && (
              <View style={s.previewMetaStack} testID="preview-meta-stack">
                {previewUrl && (
                  <View style={s.urlCard}>
                    <View style={s.urlCardHeader}>
                      <Ionicons name="link-outline" size={15} color={theme.palette.primary} />
                      <Text style={s.urlCardTitle}>Preview-Link (Browser, Secret-maskiert)</Text>
                    </View>
                    <Text style={s.urlText} numberOfLines={2}>{previewUrlDisplay ?? previewUrl}</Text>
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

                {state.remoteFailure && (
                  <View style={s.diagnosticCard} testID="preview-remote-failure-card">
                    <View style={s.urlCardHeader}>
                      <Ionicons name="cloud-offline-outline" size={15} color={theme.palette.warning} />
                      <Text style={s.urlCardTitle}>Fallback-/Remote-Diagnose</Text>
                    </View>
                    <Text style={s.diagnosticText}>{state.remoteFailure}</Text>
                  </View>
                )}

                {(webError || state.error) && (
                  <View style={s.errorBar}>
                    <Ionicons name="alert-circle" size={16} color={theme.palette.error} />
                    <Text style={s.errorText}>{webError || state.error}</Text>
                    <Pressable style={s.errorRetryBtn} onPress={handleCreate}>
                      <Text style={s.errorRetryText}>Erneut versuchen</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        <View
          style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}
          testID="preview-bottom-bar"
        >
          <Pressable style={[s.bottomBtn, state.isCreating && s.disabled]} onPress={handleCreate} disabled={state.isCreating}>
            <Ionicons name="refresh-outline" size={16} color={theme.palette.primary} />
            <Text style={s.bottomBtnText}>Neu erstellen</Text>
          </Pressable>
          <Pressable style={s.bottomBtn} onPress={handleReset}>
            <Ionicons name="trash-outline" size={16} color={theme.palette.text.secondary} />
            <Text style={[s.bottomBtnText, { color: theme.palette.text.secondary }]}>Zurücksetzen</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
