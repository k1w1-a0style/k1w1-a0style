// screens/PreviewScreen.tsx - MIT WEBVIEW MEMORY MANAGEMENT
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';

const PreviewScreen: React.FC = () => {
  const { projectData } = useProject();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [webViewKey, setWebViewKey] = useState(1);

  const webViewRef = useRef<WebView | null>(null);
  const isMountedRef = useRef(true);

  // HTML aus Projektdateien generieren (pure, memoized)
  const currentHtml = useMemo((): string => {
    if (!projectData?.files) {
      return '<html><body><h1>Kein Projekt geladen</h1></body></html>';
    }

    const htmlFile = projectData.files.find(f => f.path === 'index.html');
    if (htmlFile && htmlFile.content) {
      return htmlFile.content;
    }

    // Fallback: einfache Vorschau mit Projektinfo
    const fileCount = projectData.files.length;
    const recentFiles = projectData.files
      .slice(-5)
      .map(f => f.path)
      .join('<br>');

    const lastModified = projectData.lastModified
      ? new Date(projectData.lastModified).toLocaleString('de-DE')
      : 'unbekannt';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${projectData.name || 'K1W1 Preview'}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 20px;
              background: #0a0a0a;
              color: #e0e0e0;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            h1 {
              color: #00ff00;
              border-bottom: 2px solid #00ff00;
              padding-bottom: 10px;
            }
            .info {
              background: #121212;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              border-left: 4px solid #00ff00;
            }
            .file-list {
              background: #1a1a1a;
              padding: 15px;
              border-radius: 8px;
              font-family: 'Courier New', monospace;
              font-size: 14px;
            }
            .warning {
              background: #332200;
              color: #ffaa00;
              padding: 10px;
              border-radius: 6px;
              margin-top: 20px;
              border: 1px solid #ffaa00;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${projectData.name || 'K1W1 Projekt'}</h1>
            <div class="info">
              <strong>Projekt-Vorschau</strong><br />
              Dateien: ${fileCount}<br />
              Letzte Änderung: ${lastModified}
            </div>

            <h3>Letzte Dateien:</h3>
            <div class="file-list">
              ${recentFiles}
            </div>

            <div class="warning">
              ⚠️ Dies ist eine automatisch generierte Vorschau.<br />
              Für eine vollständige Vorschau erstelle eine index.html Datei.
            </div>
          </div>
        </body>
      </html>
    `;
  }, [projectData]);

  // Ladezustand zurücksetzen, wenn sich die HTML-Quelle ändert
  useEffect(() => {
    if (!isMountedRef.current) return;
    setHasError(false);
    setIsLoading(true);
    // WebView neu mounten, um State zu resetten
    setWebViewKey(prev => prev + 1);
  }, [currentHtml]);

  // WebView neu laden (soft reload, falls Ref existiert)
  const reloadWebView = useCallback(() => {
    if (webViewRef.current) {
      webViewRef.current.reload();
    } else {
      setWebViewKey(prev => prev + 1);
    }
  }, []);

  // Handle Android Back Button → WebView back
  useEffect(() => {
    const backAction = () => {
      if (webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => {
      backHandler.remove();
    };
  }, []);

  // Cleanup beim Unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (webViewRef.current) {
        webViewRef.current.stopLoading();
        // explizit nullen hilft GC in manchen Engines
        webViewRef.current = null;
      }
    };
  }, []);

  const handleLoadEnd = useCallback(() => {
    if (isMountedRef.current) {
      setIsLoading(false);
    }
  }, []);

  const handleError = useCallback(
    (syntheticEvent: any) => {
      const { nativeEvent } = syntheticEvent;
      // eslint-disable-next-line no-console
      console.error('WebView Fehler:', nativeEvent);

      if (!isMountedRef.current) return;

      setHasError(true);
      setIsLoading(false);

      if (Platform.OS === 'android') {
        Alert.alert(
          'Ladefehler',
          'WebView konnte die Seite nicht laden. Möglicherweise ist zu wenig Speicher verfügbar.',
          [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Neu laden', onPress: reloadWebView },
          ],
        );
      }
    },
    [reloadWebView],
  );

  const handleHttpError = useCallback((syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    // eslint-disable-next-line no-console
    console.error('HTTP Fehler:', nativeEvent);

    if (isMountedRef.current) {
      setHasError(true);
    }
  }, []);

  if (!projectData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Ionicons
            name="warning-outline"
            size={48}
            color={theme.palette.warning}
          />
          <Text style={{ color: theme.palette.warning, marginTop: 12, fontSize: 16 }}>
            Kein Projekt geladen
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={['bottom', 'left', 'right']}
    >
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.palette.primary} />
        </View>
      )}

      {hasError ? (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={theme.palette.error}
          />
          <Text style={{ color: theme.palette.error, marginTop: 12, fontSize: 16 }}>
            Fehler beim Laden der Vorschau
          </Text>
          <Text style={{ color: theme.palette.text.secondary, marginTop: 8, fontSize: 14 }}>
            Tippe zum Neuladen
          </Text>
        </View>
      ) : (
        <WebView
          key={`webview-${webViewKey}`}
          ref={webViewRef}
          source={{ html: currentHtml }}
          style={styles.webview}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          onHttpError={handleHttpError}
          startInLoadingState
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          mixedContentMode="always"
          cacheEnabled
          cacheMode="LOAD_DEFAULT"
          onShouldStartLoadWithRequest={request => {
            // Nur eigene HTML und Daten-URLs erlauben
            const url = request.url || '';
            return (
              url.startsWith('data:text/html') || url.startsWith('about:blank')
            );
          }}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="large"
                color={theme.palette.primary}
              />
            </View>
          )}
          // Android-spezifische Optimierungen
          androidLayerType="hardware"
          setBuiltInZoomControls={false}
          setDisplayZoomControls={false}
          // iOS-spezifische Optimierungen
          scrollEnabled
          bounces={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  webview: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.palette.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.palette.background,
  },
});

export default React.memo(PreviewScreen);
