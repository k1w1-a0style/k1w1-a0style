// screens/PreviewScreen.tsx – einfache HTML-Vorschau deines Projekts
import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewErrorEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

import { useProject } from '../contexts/ProjectContext';
import { theme } from '../theme';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const generateHtmlTemplate = (params: {
  projectName: string;
  version: string;
  fileCount: number;
  totalLines: number;
  appTsxContent?: string;
}): string => {
  return `
    <!DOCTYPE html>
    <html lang="de">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <title>${escapeHtml(params.projectName)} – Preview</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #0a0e14 0%, #1a1f2e 100%);
            color: #e0e0e0;
            line-height: 1.6;
          }
          h1, h2, h3 { color: #ffffff; margin-bottom: 16px; }
          h1 { font-size: 32px; font-weight: 700; }
          h2 { font-size: 24px; font-weight: 600; margin-top: 32px; }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
          }
          .card {
            background: #11151b;
            border-radius: 12px;
            border: 1px solid #242a33;
            padding: 20px;
            margin-bottom: 20px;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
          }
          .label {
            color: #9ca3af;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 8px;
            font-weight: 600;
          }
          .value {
            font-size: 16px;
            color: #ffffff;
            font-weight: 500;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
          }
          .stat-card {
            background: linear-gradient(135deg, #1a1f2e 0%, #242a33 100%);
            border-radius: 12px;
            padding: 16px;
            text-align: center;
            border: 1px solid #667eea33;
          }
          .stat-number {
            font-size: 32px;
            font-weight: 700;
            color: #667eea;
            margin-bottom: 8px;
          }
          .stat-label {
            font-size: 13px;
            color: #9ca3af;
          }
          pre {
            background: #0a0e14;
            border-radius: 12px;
            padding: 16px;
            overflow-x: auto;
            font-size: 13px;
            line-height: 1.6;
            border: 1px solid #242a33;
            font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
          }
          code {
            color: #a8b9ff;
          }
          .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 999px;
            background: #667eea22;
            border: 1px solid #667eea;
            font-size: 12px;
            margin-right: 8px;
            margin-bottom: 8px;
            color: #667eea;
            font-weight: 600;
          }
          .footer {
            margin-top: 48px;
            padding-top: 24px;
            border-top: 1px solid #242a33;
            text-align: center;
            color: #9ca3af;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📱 ${escapeHtml(params.projectName)}</h1>
          <span class="badge">v${escapeHtml(params.version)}</span>
          <span class="badge">Expo SDK 54</span>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">${params.fileCount}</div>
            <div class="stat-label">Dateien</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${params.totalLines}</div>
            <div class="stat-label">Zeilen Code</div>
          </div>
        </div>

        <div class="card">
          <div class="label">📊 Projekt-Übersicht</div>
          <div class="value">
            Dieses Projekt wurde mit dem Expo SDK 54 Builder erstellt.
          </div>
        </div>

        ${
          params.appTsxContent
            ? `
              <div class="card">
                <div class="label">📄 App.tsx</div>
                <pre><code>${params.appTsxContent}</code></pre>
              </div>
            `
            : `
              <div class="card">
                <div class="label">⚠️ App.tsx</div>
                <div class="value">Keine App.tsx im Projekt gefunden.</div>
              </div>
            `
        }

        <div class="footer">
          Generiert mit ❤️ vom Expo SDK 54 Builder
        </div>
      </body>
    </html>
  `;
};

const PreviewScreen: React.FC = () => {
  const { projectData, isLoading } = useProject();
  const [webViewError, setWebViewError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const html = useMemo(() => {
    if (!projectData) {
      return generateHtmlTemplate({
        projectName: 'Kein Projekt',
        version: '0.0.0',
        fileCount: 0,
        totalLines: 0,
      });
    }

    const files = projectData.files || [];
    const fileCount = files.length;
    const totalLines = files.reduce(
      (sum, f) => sum + String(f.content).split('\n').length,
      0
    );

    const appFile = files.find((f) => f.path === 'App.tsx');
    const pkgFile = files.find((f) => f.path === 'package.json');

    let pkgName = projectData.name || 'Expo Project';
    let pkgVersion = '1.0.0';

    if (pkgFile) {
      try {
        const pkg = JSON.parse(String(pkgFile.content));
        if (pkg.name) pkgName = String(pkg.name);
        if (pkg.version) pkgVersion = String(pkg.version);
      } catch {
        // ignore parse errors
      }
    }

    const appTsxContent = appFile ? escapeHtml(String(appFile.content)) : undefined;

    return generateHtmlTemplate({
      projectName: pkgName,
      version: pkgVersion,
      fileCount,
      totalLines,
      appTsxContent,
    });
  }, [projectData]);

  const handleWebViewError = useCallback((event: WebViewErrorEvent) => {
    console.error('[PreviewScreen] WebView Error:', event.nativeEvent);
    setWebViewError(event.nativeEvent.description || 'Fehler beim Laden der Vorschau');
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setWebViewError(null);
    setTimeout(() => setIsRefreshing(false), 500);
  }, []);

  if (isLoading && !projectData) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]} edges={['top']}>
        <ActivityIndicator size="large" color={theme.palette.primary} />
        <Text style={styles.loadingText}>Projekt wird geladen ...</Text>
      </SafeAreaView>
    );
  }

  if (webViewError) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]} edges={['top']}>
        <Ionicons name="warning-outline" size={64} color={theme.palette.error} />
        <Text style={styles.errorText}>Fehler beim Laden der Vorschau</Text>
        <Text style={styles.errorDetail}>{webViewError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.retryButtonText}>Erneut versuchen</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📄 Vorschau</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={theme.palette.primary} />
          ) : (
            <Ionicons name="refresh" size={22} color={theme.palette.primary} />
          )}
        </TouchableOpacity>
      </View>
      <WebView
        source={{ html }}
        style={styles.webview}
        onError={handleWebViewError}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.webviewLoader}>
            <ActivityIndicator size="large" color={theme.palette.primary} />
          </View>
        )}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  refreshButton: {
    padding: 8,
  },
  loadingText: {
    marginTop: 12,
    color: theme.palette.text.secondary,
    fontSize: 16,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: theme.palette.error,
    textAlign: 'center',
  },
  errorDetail: {
    marginTop: 8,
    fontSize: 14,
    color: theme.palette.text.secondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    backgroundColor: theme.palette.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  webview: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  webviewLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.palette.background,
  },
});

export default PreviewScreen;
