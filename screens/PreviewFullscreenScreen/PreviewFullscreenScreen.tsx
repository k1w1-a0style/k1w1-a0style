// screens/PreviewFullscreenScreen/PreviewFullscreenScreen.tsx
// Refactored (Patch 200): Logik → usePreviewFullscreen, hier nur Rendering.
// BUG FIX: if(!mode) und if(hasUrlParseError) sind jetzt korrekte separate Guards.

import React, { useEffect } from 'react';
import { ActivityIndicator, BackHandler, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { usePreviewFullscreen } from './hooks/usePreviewFullscreen';

import { styles } from "./PreviewFullscreenScreen.styles";

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

