// screens/shared/preview/useWebViewNavigation.ts
//
// Gemeinsamer Hook für PreviewScreen und PreviewFullscreenScreen.
// Kapselt:
//  - baseOrigin-Berechnung aus URL
//  - originWhitelist-Berechnung
//  - handleShouldStartLoad mit decidePreviewNavigation

import { useCallback, useMemo } from 'react';
import { Alert, Linking } from 'react-native';
import { decidePreviewNavigation } from '../../../utils/previewNavigation';
import { truncateUrl } from '../../../utils/url';

export type WebViewMode = 'html' | 'url';

interface UseWebViewNavigationOptions {
  mode: WebViewMode | null;
  url?: string | null;
  /** Zeigt Alert-Confirm für externe Links (true = Fullscreen, false = PreviewScreen öffnet direkt). */
  confirmExternalLinks?: boolean;
}

interface UseWebViewNavigationReturn {
  baseOrigin: string | null;
  originWhitelist: string[];
  handleShouldStartLoad: (request: { url?: string }) => boolean;
}

export function useWebViewNavigation({
  mode,
  url,
  confirmExternalLinks = true,
}: UseWebViewNavigationOptions): UseWebViewNavigationReturn {
  const baseOrigin = useMemo<string | null>(() => {
    if (mode !== 'url' || !url) return null;
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.host}`;
    } catch (error) {
      if (__DEV__) {
        console.warn('[useWebViewNavigation] invalid preview URL for url-mode origin guard', { url, error });
      }
      return null;
    }
  }, [mode, url]);

  const originWhitelist = useMemo<string[]>(() => {
    if (mode === 'html') return ['data:*', 'about:*', 'blob:*'];
    if (mode === 'url' && baseOrigin) {
      return [baseOrigin, `${baseOrigin}/*`, 'data:*', 'about:*', 'blob:*'];
    }
    return ['data:*', 'about:*', 'blob:*'];
  }, [mode, baseOrigin]);

  const handleShouldStartLoad = useCallback(
    (request: { url?: string }): boolean => {
      const requestUrl = String(request?.url || '');
      if (!mode) return false;

      const decision = decidePreviewNavigation({ mode, baseOrigin, requestUrl });

      if (decision.action === 'allow') return true;

      if (decision.action === 'block') {
        setTimeout(() => {
          Alert.alert(
            'Navigation blockiert',
            `Dieser Link kann nicht geöffnet werden:\n\n${truncateUrl(requestUrl, 90)}`,
            [{ text: 'OK' }],
          );
        }, 0);
        return false;
      }

      if (decision.action === 'external_direct') {
        setTimeout(() => {
          Linking.openURL(decision.url).catch(() => {
            Alert.alert(
              'Navigation blockiert',
              `Dieser Link kann nicht geöffnet werden:\n\n${truncateUrl(decision.url, 90)}`,
              [{ text: 'OK' }],
            );
          });
        }, 0);
        return false;
      }

      // external_confirm
      if (confirmExternalLinks) {
        Alert.alert(
          'Externen Link öffnen?',
          truncateUrl(decision.url, 160),
          [
            { text: 'Abbrechen', style: 'cancel' },
            {
              text: 'Öffnen',
              onPress: () => {
                Linking.openURL(decision.url).catch((error) => {
                  console.warn('[useWebViewNavigation] failed to open external URL', { url: decision.url, error });
                  Alert.alert(
                    'Navigation blockiert',
                    `Dieser Link kann nicht geöffnet werden:\n\n${truncateUrl(decision.url, 90)}`,
                    [{ text: 'OK' }],
                  );
                });
              },
            },
          ],
        );
      } else {
        setTimeout(() => {
          Linking.openURL(decision.url).catch((error) => {
            console.warn('[useWebViewNavigation] failed to open external URL', { url: decision.url, error });
            Alert.alert(
              'Navigation blockiert',
              `Dieser Link kann nicht geöffnet werden:\n\n${truncateUrl(decision.url, 90)}`,
              [{ text: 'OK' }],
            );
          });
        }, 0);
      }
      return false;
    },
    [mode, baseOrigin, confirmExternalLinks],
  );

  return { baseOrigin, originWhitelist, handleShouldStartLoad };
}
