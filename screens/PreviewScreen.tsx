import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';

type DeviceMode = 'mobile' | 'tablet';

const escapeHtml = (input: string) =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export default function PreviewScreen() {
  const { projectData } = useProject();
  const [device, setDevice] = useState<DeviceMode>('mobile');
  const [reloadKey, setReloadKey] = useState(0);
  const lastHashRef = useRef<string>('');

  // 🔁 Live Reload bei Projektänderungen
  useEffect(() => {
    if (!projectData?.files) return;

    const hash = JSON.stringify(
      projectData.files.map((f) => `${f.path}:${String(f.content).length}`),
    );

    if (hash !== lastHashRef.current) {
      lastHashRef.current = hash;
      setReloadKey((k) => k + 1);
    }
  }, [projectData]);

  const htmlContent = useMemo(() => {
    if (!projectData) {
      return errorHtml('Kein Projekt geladen', 'Erstelle oder importiere ein Projekt.');
    }

    if (!projectData.files || projectData.files.length === 0) {
      return errorHtml(
        'Projekt ist leer',
        'Erstelle Dateien über den CodeScreen oder nutze die KI.',
      );
    }

    const appFile = projectData.files.find(
      (f) => f.path === 'App.tsx' || f.path === 'App.js',
    );

    if (!appFile) {
      return errorHtml(
        'Kein App.tsx gefunden',
        'Dein Projekt braucht eine App.tsx als Einstiegspunkt.',
      );
    }

    const fileList = projectData.files
      .map(
        (f) =>
          `<li><strong>${escapeHtml(f.path)}</strong> (${String(f.content).length} bytes)</li>`,
      )
      .join('');

    const appPreview = escapeHtml(
      typeof appFile.content === 'string'
        ? appFile.content
        : JSON.stringify(appFile.content, null, 2),
    );

    return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body {
              background: #0a0a0a;
              color: #e0e0e0;
              font-family: system-ui, sans-serif;
              padding: 16px;
            }
            h1 {
              color: #00ff00;
              margin-bottom: 8px;
            }
            .box {
              border: 1px solid #333;
              border-radius: 14px;
              padding: 16px;
              margin-bottom: 16px;
              background: rgba(0,255,0,0.05);
            }
            ul {
              list-style: none;
              padding: 0;
              margin: 0;
            }
            li {
              padding: 6px 0;
              border-bottom: 1px solid #222;
            }
            pre {
              background: #000;
              padding: 12px;
              border-radius: 12px;
              overflow-x: auto;
              font-size: 11px;
              border: 1px solid #222;
            }
            .hint {
              color: #999;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <h1>⚡ ${escapeHtml(projectData.name || 'Preview')}</h1>

          <div class="box">
            <h3>Live Preview (Simulation)</h3>
            <p class="hint">
              Dies ist eine visuelle HTML-Simulation deines React-Native-Projekts.
              Kein Code wird ausgeführt.
            </p>
          </div>

          <div class="box">
            <h3>Dateien (${projectData.files.length})</h3>
            <ul>${fileList}</ul>
          </div>

          <div class="box">
            <h3>App.tsx Preview</h3>
            <pre>${appPreview}</pre>
          </div>
        </body>
      </html>
    `;
  }, [projectData]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* TOOLBAR */}
      <View style={styles.toolbar}>
        <Text style={styles.title}>Live Preview</Text>

        <View style={styles.toolbarRight}>
          <TouchableOpacity onPress={() => setReloadKey((k) => k + 1)}>
            <Ionicons name="refresh" size={20} color={theme.palette.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDevice('mobile')}>
            <Ionicons
              name="phone-portrait"
              size={20}
              color={device === 'mobile' ? theme.palette.primary : '#555'}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDevice('tablet')}>
            <Ionicons
              name="tablet-landscape"
              size={20}
              color={device === 'tablet' ? theme.palette.primary : '#555'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* WEBVIEW */}
      <View style={styles.previewContainer}>
        <View
          style={[
            styles.deviceFrame,
            device === 'mobile' ? styles.mobile : styles.tablet,
          ]}
        >
          <WebView
            key={reloadKey}
            originWhitelist={['*']}
            source={{ html: htmlContent }}
            style={{ flex: 1, backgroundColor: '#000' }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

// ❌ Error Overlay HTML
function errorHtml(title: string, message: string) {
  return `
    <html>
      <body style="
        background:#0a0a0a;
        color:#ff4444;
        font-family:sans-serif;
        display:flex;
        flex-direction:column;
        justify-content:center;
        align-items:center;
        padding:24px;
        text-align:center;
      ">
        <h1>❌ ${title}</h1>
        <p>${message}</p>
      </body>
    </html>
  `;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.palette.background },

  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  title: { color: theme.palette.text.primary, fontWeight: '700', fontSize: 16 },
  toolbarRight: { flexDirection: 'row', gap: 16 },

  previewContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  deviceFrame: {
    borderWidth: 10,
    borderColor: '#333',
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  mobile: {
    width: '100%',
    maxWidth: 360,
    height: '92%',
  },
  tablet: {
    width: '100%',
    maxWidth: 900,
    height: '85%',
  },
});
