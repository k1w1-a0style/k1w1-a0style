// screens/PreviewFullscreenScreen/hooks/usePreviewFullscreen.ts

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Share } from 'react-native';
import type { WebView, WebViewNavigation } from 'react-native-webview';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { isHttpUrl } from '../../../utils/url';
import { getPreviewRemoteUrlStatus } from '../../../hooks/previewHelpers';
import { useWebViewNavigation } from '../../shared/preview/useWebViewNavigation';
import { useWebViewCrashRecovery } from '../../shared/preview/useWebViewCrashRecovery';
import { redactPreviewUrl } from '../../shared/preview/previewUrlRedaction';
import { logger } from '../../../lib/logger';
import type { RootStackParamList } from '../../../types/preview';

type PreviewFullscreenRouteProp = RouteProp<RootStackParamList, 'PreviewFullscreen'>;
type PreviewFullscreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PreviewFullscreen'>;

export function usePreviewFullscreen() {
  const navigation = useNavigation<PreviewFullscreenNavigationProp>();
  const route = useRoute<PreviewFullscreenRouteProp>();

  const title = route.params?.title ?? 'Preview';
  const url = route.params?.url;
  const html = route.params?.html ?? '';
  // FIX: keine baseUrl — verhindert ERR_CONNECTION_REFUSED
  const baseUrl = route.params?.baseUrl ?? undefined;
  const remoteUrlStatus = useMemo(
    () => getPreviewRemoteUrlStatus(typeof url === 'string' ? url : null),
    [url],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const webViewRef = useRef<WebView>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ─── Mode ─────────────────────────────────────────────────────────────────
  const mode = useMemo<'html' | 'url' | null>(() => {
    if (html.trim().length > 0) return 'html';
    if (
      typeof url === 'string' &&
      url.length > 0 &&
      isHttpUrl(url) &&
      remoteUrlStatus === 'trusted'
    ) {
      return 'url';
    }
    return null;
  }, [html, url, remoteUrlStatus]);

  // ─── URL-Parse-Error als separates Flag ───────────────────────────────────
  const hasUrlParseError = useMemo<boolean>(() => {
    if (mode !== 'url' || !url) return false;
    try {
      new URL(url);
      return false;
    } catch (error) {
      logger.warn('[usePreviewFullscreen] invalid preview URL parsing failed', {
        url: redactPreviewUrl(url),
        errorType: error instanceof Error ? error.name : typeof error,
      });
      return true;
    }
  }, [mode, url]);

  // ─── Shared WebView navigation ─────────────────────────────────────────────
  const { baseOrigin, originWhitelist, handleShouldStartLoad } = useWebViewNavigation({
    mode,
    url,
    confirmExternalLinks: true,
  });

  // ─── Crash recovery ────────────────────────────────────────────────────────
  const { handleContentProcessDidTerminate, handleRenderProcessGone, resetRecoveryState } =
    useWebViewCrashRecovery({
      webViewRef,
      isMountedRef,
      onError: setError,
      onLoadingChange: setLoading,
    });

  // ─── Derived ───────────────────────────────────────────────────────────────
  const headerSubtitle = useMemo(() => {
    if (mode === 'html') return 'Lokaler HTML-/Eval-Fallback · nicht server-verifiziert';
    if (mode === 'url' && url) return `Aktive Supabase-Preview · ${redactPreviewUrl(url)}`;
    if (remoteUrlStatus === 'insecure') return 'Remote-Preview blockiert · unsicherer Link';
    if (remoteUrlStatus === 'invalid') return 'Remote-Preview blockiert · ungültige URL';
    return 'Keine Preview aktiv';
  }, [mode, url, remoteUrlStatus]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleGoBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleWebViewGoBack = useCallback(() => {
    if (canGoBack) webViewRef.current?.goBack();
  }, [canGoBack]);

  const handleWebViewGoForward = useCallback(() => {
    if (canGoForward) webViewRef.current?.goForward();
  }, [canGoForward]);

  const handleReload = useCallback(() => {
    resetRecoveryState();
    webViewRef.current?.reload();
    setError(null);
  }, [resetRecoveryState]);

  const handleShare = useCallback(async () => {
    try {
      if (mode === 'url' && url) {
        Alert.alert(
          'Secret-Link teilen?',
          `Dieser Link enthaelt ein Zugriffstoken.\n\n${redactPreviewUrl(url)}\n\nNur ueber sichere Kanaele teilen.`,
          [
            { text: 'Abbrechen', style: 'cancel' },
            {
              text: 'Trotzdem teilen',
              style: 'destructive',
              onPress: () => {
                void Share.share({ message: `Preview-Link: ${url}`, url, title });
              },
            },
          ],
        );
      } else {
        await Share.share({ message: `Preview: ${title}`, title });
      }
    } catch (err) {
      logger.error('PreviewFullscreen', 'Share failed', err);
    }
  }, [mode, url, title]);

  const handleOpenExternal = useCallback(async () => {
    if (mode === 'url' && url) {
      Alert.alert(
        'Secret-Link extern oeffnen?',
        `Der externe Browser kann den Link in Verlauf/Referrer sichtbar machen.\n\n${redactPreviewUrl(url)}`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Im Browser oeffnen',
            onPress: () => {
              void (async () => {
                try {
                  await Linking.openURL(url);
                } catch (err) {
                  logger.error('PreviewFullscreen', 'External open failed', err);
                  Alert.alert('Fehler', 'Browser konnte nicht geoeffnet werden.');
                }
              })();
            },
          },
        ],
      );
    } else {
      Alert.alert('ℹ️ Hinweis', 'Dieser lokale HTML-/Eval-Fallback kann nicht im externen Browser geöffnet werden.');
    }
  }, [mode, url]);

  const handleLoadStart = useCallback(() => {
    if (!isMountedRef.current) return;
    setLoading(true);
    setError(null);
  }, []);

  const handleLoadEnd = useCallback(() => {
    if (!isMountedRef.current) return;
    setLoading(false);
  }, []);

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    if (!isMountedRef.current) return;
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);
  }, []);

  const handleError = useCallback((syntheticEvent: { nativeEvent?: { description?: string } }) => {
    if (!isMountedRef.current) return;
    const msg = syntheticEvent.nativeEvent?.description || 'Unbekannter WebView-Fehler';
    setError(msg);
    setLoading(false);
    logger.error('PreviewFullscreen', 'WebView Error', syntheticEvent.nativeEvent);
  }, []);

  const handleHttpError = useCallback(
    (syntheticEvent: { nativeEvent?: { statusCode?: number; description?: string } }) => {
      if (!isMountedRef.current) return;
      const { nativeEvent } = syntheticEvent;
      const statusCode = nativeEvent?.statusCode;
      const description = nativeEvent?.description || '';

      if (statusCode === 404) {
        setError('HTTP 404: Preview abgelaufen oder nicht gefunden');
        setLoading(false);
        Alert.alert(
          'Preview nicht gefunden',
          'Die Preview ist abgelaufen oder ungültig. Bitte neu erstellen.',
          [
            { text: 'Zurück', onPress: handleGoBack, style: 'cancel' },
            { text: 'Neu laden', onPress: handleReload },
          ],
        );
        return;
      }

      setError(`HTTP ${statusCode}${description ? `: ${description}` : ''}`);
      setLoading(false);
    },
    [handleGoBack, handleReload],
  );

  return {
    title, url, html, baseUrl,
    mode,
    hasUrlParseError,
    baseOrigin,
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
  };
}
