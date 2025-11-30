// screens/PreviewScreen.tsx – einfache HTML-Vorschau deines Projekts
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

import { useProject } from '../contexts/ProjectContext';
import { theme } from '../theme';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const PreviewScreen: React.FC = () => {
  const { projectData, isLoading } = useProject();

  const html = useMemo(() => {
    if (!projectData) {
      return '<h1>Kein Projekt geladen</h1>';
    }

    const files = projectData.files || [];
    const fileCount = files.length;
    const totalLines = files.reduce(
      (sum, f) => sum + String(f.content).split('\n').length,
      0
    );

    const appFile = files.find((f) => f.path === 'App.tsx');
    const pkgFile = files.find((f) => f.path === 'package.json');

    let pkgName = projectData.name;
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

    const appSource = appFile ? escapeHtml(String(appFile.content)) : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${escapeHtml(pkgName)} – Preview</title>
          <style>
            body {
              margin: 0;
              padding: 16px;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              background: #050608;
              color: #e0e0e0;
            }
            h1, h2, h3 {
              color: #ffffff;
            }
            .card {
              background: #11151b;
              border-radius: 8px;
              border: 1px solid #242a33;
              padding: 12px 14px;
              margin-bottom: 16px;
            }
            .label {
              color: #9ca3af;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: .08em;
            }
            .value {
              font-size: 14px;
            }
            pre {
              background: #050608;
              border-radius: 8px;
              padding: 12px;
              overflow-x: auto;
              font-size: 12px;
              line-height: 1.4;
            }
            .badge {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 999px;
              background: #111827;
              border: 1px solid #1f2937;
              font-size: 11px;
              margin-right: 4px;
              margin-bottom: 4px;
            }
          </style>
        </head>
        <body>
          <h1>📱 ${escapeHtml(pkgName)}</h1>
          <div class="card">
            <div class="label">Version</div>
            <div class="value">${escapeHtml(pkgVersion)}</div>
          </div>
          <div class="card">
            <div class="label">Projekt-Statistik</div>
            <div class="value">
              Dateien: <strong>${fileCount}</strong><br/>
              Zeilen: <strong>${totalLines}</strong>
            </div>
          </div>
          <div class="card">
            <div class="label">App.tsx</div>
            ${
              appFile
                ? `<pre><code>${appSource}</code></pre>`
                : '<div class="value">Keine <code>App.tsx</code> im Projekt gefunden.</div>'
            }
          </div>
        </body>
      </html>
    `;
  }, [projectData]);

  if (isLoading && !projectData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.palette.primary} />
        <Text style={styles.loadingText}>Projekt wird geladen ...</Text>
      </View>
    );
  }

  if (!projectData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>Kein Projekt geladen.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView source={{ html }} style={styles.webview} />
    </View>
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
  },
  loadingText: {
    marginTop: 12,
    color: theme.palette.text.secondary,
  },
  emptyText: {
    color: theme.palette.text.secondary,
  },
  webview: {
    flex: 1,
  },
});

export default PreviewScreen;
