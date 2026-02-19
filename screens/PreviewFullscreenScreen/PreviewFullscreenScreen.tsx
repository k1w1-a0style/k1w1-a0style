// screens/PreviewFullscreenScreen/PreviewFullscreenScreen.tsx
// Refactored (Patch 200): Logik → usePreviewFullscreen, hier nur Rendering.
// BUG FIX: if(!mode) und if(hasUrlParseError) sind jetzt korrekte separate Guards.

import React, { useEffect } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { usePreviewFullscreen } from './hooks/usePreviewFullscreen';

export default function PreviewFullscreenScreen() {
  const {
    title, url, html, baseUrl,
    mode, hasUrlParseError,
    originWhitelist,
    loading, error,
    canGoBack, canGoForward,
    webViewRef,
    handleGoBack,
    handleWebViewGoBack, handleWebViewGoForward,
    handleReload, handleShare, handleOpenExternal,
    handleLoadStart, handleLoadEnd,
    handleNavigationStateChange,
    handleShouldStartLoad,
    handleError, handleHttpError,
    handleContentProcessDidTerminate,
    handleRenderProcessGone,
    headerSubtitle,
  } = usePreviewFullscreen();

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) { handleWebViewGoBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack, handleWebViewGoBack]);

  // ─── Guard 1: Keine gültige Preview ───────────────────────────────────────
  if (!mode) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={18} color={theme.palette.text.primary} />
            <Text style={styles.backButtonText}>Zurück</Text>
          </Pressable>
          <View style={styles.titleContainer}>
            <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.topSubtitle} numberOfLines={1}>Keine gültige URL/HTML</Text>
          </View>
          <View style={{ width: 80 }} />
        </View>
        <View style={styles.errorState}>
          <Ionicons name="alert-circle" size={64} color={theme.palette.error} />
          <Text style={styles.errorStateTitle}>Keine gültige Preview</Text>
          <Text style={styles.errorStateText}>
            Es wurde weder eine gültige URL noch HTML übergeben.{'\n'}
            Gehe zurück und erstelle die Preview neu.
          </Text>
          <Pressable style={styles.retryButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={16} color={theme.palette.text.primary} />
            <Text style={styles.retryButtonText}>Zurück</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Guard 2: URL nicht parseable (war vorher dead code!) ─────────────────
  if (hasUrlParseError) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="chevron-back" size={24} color={theme.palette.text.primary} />
          </Pressable>
          <View style={styles.titleContainer}>
            <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.topSubtitle} numberOfLines={1}>Ungültige URL</Text>
          </View>
          <View style={{ width: 80 }} />
        </View>
        <View style={styles.errorState}>
          <Ionicons name="alert-circle" size={64} color={theme.palette.error} />
          <Text style={styles.errorStateTitle}>Ungültige Preview-URL</Text>
          <Text style={styles.errorStateText}>
            Die angegebene URL konnte nicht verarbeitet werden.
            Bitte prüfe das Format (http/https) und versuche es erneut.
          </Text>
          <Pressable style={styles.retryButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={16} color={theme.palette.text.primary} />
            <Text style={styles.retryButtonText}>Zurück</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Normal Preview ────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={18} color={theme.palette.text.primary} />
          <Text style={styles.backButtonText}>Zurück</Text>
        </Pressable>
        <View style={styles.titleContainer}>
          <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.topSubtitle} numberOfLines={1}>{headerSubtitle}</Text>
        </View>
        <View style={styles.actions}>
          {canGoBack && (
            <Pressable style={styles.iconButton} onPress={handleWebViewGoBack}>
              <Ionicons name="chevron-back" size={20} color={theme.palette.text.primary} />
            </Pressable>
          )}
          {canGoForward && (
            <Pressable style={styles.iconButton} onPress={handleWebViewGoForward}>
              <Ionicons name="chevron-forward" size={20} color={theme.palette.text.primary} />
            </Pressable>
          )}
          <Pressable style={styles.iconButton} onPress={handleReload}>
            <Ionicons name="refresh" size={18} color={theme.palette.text.primary} />
          </Pressable>
          {mode === 'url' && (
            <Pressable style={styles.iconButton} onPress={handleOpenExternal}>
              <Ionicons name="open-outline" size={18} color={theme.palette.primary} />
            </Pressable>
          )}
          <Pressable style={styles.iconButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={18} color={theme.palette.text.primary} />
          </Pressable>
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>⚠️ {error}</Text>
          <Pressable onPress={handleReload} style={styles.errorBannerButton}>
            <Text style={styles.errorBannerButtonText}>Neu laden</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.webViewContainer}>
        <WebView
          ref={webViewRef}
          originWhitelist={originWhitelist}
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          onNavigationStateChange={handleNavigationStateChange}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          onHttpError={handleHttpError}
          onContentProcessDidTerminate={handleContentProcessDidTerminate}
          onRenderProcessGone={handleRenderProcessGone}
          startInLoadingState
          style={styles.webView}
          mixedContentMode="always"
          source={mode === 'html' ? { html, baseUrl } : { uri: url! }}
        />
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.palette.primary} />
            <Text style={styles.loadingText}>Lade Preview…</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.palette.background },
  topBar: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  backButton: {
    flexDirection: 'row', alignItems: 'center', columnGap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1,
    borderColor: theme.palette.border, backgroundColor: theme.palette.card,
  },
  backButtonText: { color: theme.palette.text.primary, fontWeight: '800', fontSize: 14 },
  titleContainer: { flex: 1, minWidth: 0 },
  topTitle: { color: theme.palette.text.primary, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  topSubtitle: { color: theme.palette.text.secondary, fontSize: 11, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconButton: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1,
    borderColor: theme.palette.border, backgroundColor: theme.palette.card,
    alignItems: 'center', justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#ffebee',
    borderBottomWidth: 1, borderBottomColor: '#d32f2f', gap: 10,
  },
  errorBannerText: { flex: 1, color: '#c62828', fontSize: 13, fontWeight: '700' },
  errorBannerButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#d32f2f' },
  errorBannerButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  webViewContainer: { flex: 1, backgroundColor: '#000', position: 'relative' },
  webView: { flex: 1, backgroundColor: '#000' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  loadingText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorStateTitle: {
    color: theme.palette.text.primary, fontSize: 18, fontWeight: '900',
    textAlign: 'center', marginTop: 12,
  },
  errorStateText: {
    color: theme.palette.text.secondary, fontSize: 14,
    textAlign: 'center', lineHeight: 20, maxWidth: 400,
  },
  retryButton: {
    flexDirection: 'row', alignItems: 'center', columnGap: 8, marginTop: 20,
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: theme.palette.card, borderRadius: 12,
    borderWidth: 1, borderColor: theme.palette.border,
  },
  retryButtonText: { color: theme.palette.text.primary, fontSize: 14, fontWeight: '800' },
});
