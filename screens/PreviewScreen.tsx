// screens/PreviewScreen.tsx - Live Preview über lokale Dateien
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
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';
import type { ProjectFile } from '../contexts/types';

const BINARY_EXTENSIONS =
  /\.(png|jpe?g|gif|webp|bmp|ico|ttf|otf|woff2?|mp3|mp4|wav|ogg|pdf|mov|avi)$/i;
const PREVIEW_BASE =
  (FileSystem.cacheDirectory ??
    FileSystem.documentDirectory ??
    'file:///data/local/tmp/') + 'preview-runtime/';

const DEFAULT_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>K1W1 Vorschau</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: radial-gradient(circle at top, #0b2713 0%, #020402 65%);
        color: #f0fff0;
      }
      .card {
        background: rgba(0, 0, 0, 0.6);
        border-radius: 20px;
        padding: 32px;
        max-width: 520px;
        text-align: center;
        box-shadow: 0 10px 35px rgba(0, 0, 0, 0.55);
        border: 1px solid rgba(0, 255, 120, 0.25);
      }
      h1 {
        margin-top: 0;
        font-size: 2rem;
      }
      p {
        color: #b3ffcf;
        line-height: 1.5;
      }
      .badge {
        display: inline-flex;
        margin-top: 12px;
        padding: 6px 14px;
        border-radius: 999px;
        background: rgba(0, 255, 120, 0.1);
        border: 1px solid rgba(0, 255, 120, 0.35);
        font-size: 0.8rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Willkommen zur Vorschau</h1>
      <p>Lege eine <strong>index.html</strong> oder eine andere HTML-Datei an, um hier deine App zu sehen.</p>
      <p>Alle relativen CSS/JS-Dateien werden automatisch unterstützt.</p>
      <div class="badge">Projekt bereit</div>
    </div>
  </body>
</html>`;

type PreviewCacheMeta = {
  projectKey: string;
  lastModified?: string;
  entryPath?: string;
  entryUri?: string;
};

const normalizePath = (value: string): string => {
  if (!value) return '';
  return value
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/\/+/g, '/')
    .replace(/^\//, '');
};

const sanitizeSegment = (value: string | undefined): string => {
  if (!value) return 'project';
  const cleaned = value.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '');
  return cleaned.length ? cleaned.slice(0, 48) : 'project';
};

const extractBase64Payload = (content: string): string => {
  if (!content) return '';
  const marker = 'base64,';
  const idx = content.indexOf(marker);
  return idx >= 0 ? content.slice(idx + marker.length) : content;
};

const isBinaryFile = (path: string): boolean => BINARY_EXTENSIONS.test(path);

const ensureDirectory = async (
  dir: string,
  cache: Set<string>,
): Promise<void> => {
  if (!dir || cache.has(dir)) return;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  cache.add(dir);
};

const writeProjectFilesToDisk = async (
  projectKey: string,
  files: ProjectFile[],
  entryPath: string,
): Promise<string> => {
  const normalizedEntry = normalizePath(entryPath);
  if (!normalizedEntry) {
    throw new Error('Kein Einstiegspunkt für die Vorschau gefunden.');
  }

  const rootDir = `${PREVIEW_BASE}${projectKey}/`;
  await FileSystem.deleteAsync(rootDir, { idempotent: true });
  await FileSystem.makeDirectoryAsync(rootDir, { intermediates: true });

  const dirCache = new Set<string>([rootDir.replace(/\/+$/, '')]);

  for (const file of files) {
    const normalizedPath = normalizePath(file.path);
    if (!normalizedPath) continue;

    if (normalizedPath.endsWith('/')) {
      await ensureDirectory(`${rootDir}${normalizedPath}`, dirCache);
      continue;
    }

    const targetPath = `${rootDir}${normalizedPath}`;
    const parentDir = targetPath.slice(0, targetPath.lastIndexOf('/'));
    if (parentDir) {
      await ensureDirectory(parentDir, dirCache);
    }

    const rawContent =
      typeof file.content === 'string'
        ? file.content
        : JSON.stringify(file.content ?? '', null, 2);

    if (isBinaryFile(normalizedPath)) {
      const payload = extractBase64Payload(rawContent);
      await FileSystem.writeAsStringAsync(targetPath, payload, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } else {
      await FileSystem.writeAsStringAsync(targetPath, rawContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    }
  }

  const entryUri = `${rootDir}${normalizedEntry}`;
  const entryInfo = await FileSystem.getInfoAsync(entryUri);
  if (!entryInfo.exists) {
    throw new Error(
      `Eintrittsdatei "${normalizedEntry}" wurde nicht gefunden oder konnte nicht geschrieben werden.`,
    );
  }

  return entryUri;
};

const PreviewScreen: React.FC = () => {
  const { projectData, createFile } = useProject();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [webViewKey, setWebViewKey] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [entryUri, setEntryUri] = useState<string | null>(null);
  const [resyncCounter, setResyncCounter] = useState(0);

  const webViewRef = useRef<WebView | null>(null);
  const isMountedRef = useRef(true);
  const previewCacheRef = useRef<PreviewCacheMeta | null>(null);

  const projectStats = useMemo(() => {
    if (!projectData) {
      return { files: 0, lastModified: null as string | null };
    }
    return {
      files: projectData.files?.length ?? 0,
      lastModified: projectData.lastModified
        ? new Date(projectData.lastModified).toLocaleString('de-DE')
        : null,
    };
  }, [projectData]);

  // Prüfe ob es ein React Native Projekt ist
  const isReactNativeProject = useMemo(() => {
    if (!projectData?.files) return false;
    const hasAppTsx = projectData.files.some(f => 
      f.path === 'App.tsx' || f.path === 'App.js'
    );
    const hasPackageJson = projectData.files.some(f => f.path === 'package.json');
    if (hasPackageJson) {
      const pkgFile = projectData.files.find(f => f.path === 'package.json');
      if (pkgFile?.content?.includes('"expo"') || pkgFile?.content?.includes('"react-native"')) {
        return true;
      }
    }
    return hasAppTsx;
  }, [projectData?.files]);

  const htmlEntries = useMemo(() => {
    if (!projectData?.files) return [];
    return projectData.files
      .filter(file => /\.html?$/i.test(file.path))
      .map(file => file.path)
      .sort((a, b) => {
        // Priorisiere preview.html für React Native Projekte
        if (a.toLowerCase() === 'preview.html') return -1;
        if (b.toLowerCase() === 'preview.html') return 1;
        if (a.toLowerCase() === 'index.html') return -1;
        if (b.toLowerCase() === 'index.html') return 1;
        return a.localeCompare(b);
      });
  }, [projectData?.files]);

  useEffect(() => {
    if (!htmlEntries.length) {
      if (selectedEntry !== null) setSelectedEntry(null);
      return;
    }
    if (!selectedEntry || !htmlEntries.includes(selectedEntry)) {
      setSelectedEntry(htmlEntries[0]);
    }
  }, [htmlEntries, selectedEntry]);

  const previewEntryPath = useMemo(() => {
    if (!selectedEntry) return null;
    return normalizePath(selectedEntry);
  }, [selectedEntry]);

  const ensurePreviewOnDisk = useCallback(async () => {
    if (!projectData || !previewEntryPath) {
      setEntryUri(null);
      return;
    }

    const projectKey = sanitizeSegment(
      projectData.id || projectData.slug || projectData.name,
    );

    const cached = previewCacheRef.current;
    if (
      cached &&
      cached.projectKey === projectKey &&
      cached.lastModified === projectData.lastModified &&
      cached.entryPath === previewEntryPath &&
      cached.entryUri
    ) {
      const info = await FileSystem.getInfoAsync(cached.entryUri);
      if (info.exists) {
        setEntryUri(cached.entryUri);
        return;
      }
    }

    setSyncing(true);
    setSyncError(null);

    try {
      const uri = await writeProjectFilesToDisk(
        projectKey,
        projectData.files ?? [],
        previewEntryPath,
      );
      if (isMountedRef.current) {
        previewCacheRef.current = {
          projectKey,
          lastModified: projectData.lastModified,
          entryPath: previewEntryPath,
          entryUri: uri,
        };
        setEntryUri(uri);
      }
    } catch (error: any) {
      if (isMountedRef.current) {
        console.error('[PreviewScreen] Sync-Fehler', error);
        setEntryUri(null);
        setSyncError(
          error?.message ||
            'Dateien konnten nicht für die Vorschau geschrieben werden.',
        );
      }
    } finally {
      if (isMountedRef.current) {
        setSyncing(false);
      }
    }
  }, [projectData, previewEntryPath]);

  useEffect(() => {
    ensurePreviewOnDisk();
  }, [ensurePreviewOnDisk, resyncCounter]);

  useEffect(() => {
    if (!isMountedRef.current) return;
    if (!entryUri) {
      setIsLoading(false);
      return;
    }
    setHasError(false);
    setIsLoading(true);
    setWebViewKey(prev => prev + 1);
  }, [entryUri]);

  const reloadWebView = useCallback(() => {
    if (webViewRef.current) {
      webViewRef.current.reload();
    } else {
      setWebViewKey(prev => prev + 1);
    }
  }, []);

  const forceResync = useCallback(() => {
    previewCacheRef.current = null;
    setEntryUri(null);
    setResyncCounter(prev => prev + 1);
  }, []);

  useEffect(() => {
    const backAction = () => {
      if (webViewRef.current && entryUri) {
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
  }, [entryUri]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (webViewRef.current) {
        webViewRef.current.stopLoading();
        webViewRef.current = null;
      }
    };
  }, []);

  const handleLoadEnd = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsLoading(false);
  }, []);

  const handleError = useCallback(
    (syntheticEvent: any) => {
      const { nativeEvent } = syntheticEvent;
      console.error('WebView Fehler:', nativeEvent);

      if (!isMountedRef.current) return;

      setHasError(true);
      setIsLoading(false);

      Alert.alert(
        'Vorschau fehlgeschlagen',
        'Die Vorschau konnte nicht geladen werden. Prüfe deine HTML-Datei oder lade neu.',
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Neu laden', onPress: reloadWebView },
        ],
      );
    },
    [reloadWebView],
  );

  const handleHttpError = useCallback((syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('HTTP Fehler:', nativeEvent);

    if (isMountedRef.current) {
      setHasError(true);
    }
  }, []);

  const handleExternalNav = useCallback(request => {
    const url: string = request.url || '';
    if (
      url.startsWith('file://') ||
      url.startsWith('data:') ||
      url.startsWith('about:blank') ||
      url.startsWith('blob:')
    ) {
      return true;
    }

    if (
      /^https?:/i.test(url) ||
      url.startsWith('mailto:') ||
      url.startsWith('tel:')
    ) {
      Linking.openURL(url).catch(() => null);
      return false;
    }

    return false;
  }, []);

  const PREVIEW_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>K1W1 App Preview</title>
  <style>
    :root { --primary: #00FF00; --bg: #000; --card: #111; --border: #222; --text: #fff; --text-secondary: #aaa; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; }
    .content { text-align: center; max-width: 400px; }
    .emoji { font-size: 64px; margin-bottom: 16px; }
    h1 { font-size: 28px; color: var(--primary); margin-bottom: 8px; text-shadow: 0 0 20px rgba(0,255,0,0.3); }
    .subtitle { color: var(--text-secondary); margin-bottom: 24px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 20px; margin-bottom: 16px; }
    .card-title { color: var(--primary); font-weight: 600; margin-bottom: 8px; }
    .card-text { color: var(--text-secondary); font-size: 14px; line-height: 1.6; }
    .badge { display: inline-block; background: rgba(0,255,0,0.1); border: 1px solid rgba(0,255,0,0.3); padding: 6px 12px; border-radius: 20px; font-size: 12px; color: var(--primary); margin-top: 16px; }
  </style>
</head>
<body>
  <div class="content">
    <div class="emoji">📱</div>
    <h1>App-Vorschau</h1>
    <p class="subtitle">React Native Projekt</p>
    <div class="card">
      <div class="card-title">Vorschau-Modus</div>
      <p class="card-text">Dies ist eine Web-Vorschau deiner App. Für die echte App-Erfahrung nutze Expo Go auf deinem Handy oder starte einen Build.</p>
    </div>
    <div class="badge">K1W1 Preview</div>
  </div>
</body>
</html>`;

  const handleCreatePreviewHtml = useCallback(() => {
    const fileName = isReactNativeProject ? 'preview.html' : 'index.html';
    const template = isReactNativeProject ? PREVIEW_HTML_TEMPLATE : DEFAULT_HTML_TEMPLATE;
    
    Alert.alert(
      `${fileName} anlegen`,
      isReactNativeProject 
        ? 'Es wird eine Web-Vorschau für dein React Native Projekt erstellt.'
        : 'Es wird eine einfache Startdatei mit Live-Reload vorbereitet.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Erstellen',
          onPress: async () => {
            try {
              await createFile(fileName, template);
              Alert.alert('Fertig', `${fileName} wurde erstellt.`);
            } catch (error: any) {
              Alert.alert(
                'Fehler',
                error?.message || `${fileName} konnte nicht erstellt werden.`,
              );
            }
          },
        },
      ],
    );
  }, [createFile, isReactNativeProject]);

  // Alias für Abwärtskompatibilität
  const handleCreateIndexHtml = handleCreatePreviewHtml;

  if (!projectData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Ionicons
            name="warning-outline"
            size={48}
            color={theme.palette.warning}
          />
          <Text
            style={{ color: theme.palette.warning, marginTop: 12, fontSize: 16 }}
          >
            Kein Projekt geladen
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasHtmlEntry = htmlEntries.length > 0;

  return (
    <SafeAreaView
      style={styles.container}
      edges={['bottom', 'left', 'right']}
    >
      {!!(isLoading || syncing) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.palette.primary} />
          <Text style={styles.loadingText}>
            {syncing ? 'Dateien werden vorbereitet …' : 'Vorschau wird geladen …'}
          </Text>
        </View>
      )}

      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.projectName} numberOfLines={1}>
            {projectData.name || 'Projekt-Vorschau'}
          </Text>
          <Text style={styles.metaText}>
            Dateien: {projectStats.files} ·{' '}
            {projectStats.lastModified
              ? `Stand ${projectStats.lastModified}`
              : 'Kein Änderungsdatum'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={forceResync}
            style={styles.iconButton}
            accessibilityLabel="Dateien neu laden"
          >
            <Ionicons
              name="refresh-outline"
              size={20}
              color={theme.palette.text.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={reloadWebView}
            style={styles.iconButton}
            accessibilityLabel="WebView neu laden"
          >
            <Ionicons
              name="reload-circle-outline"
              size={22}
              color={theme.palette.text.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Ionicons
            name="flash-outline"
            size={14}
            color={theme.palette.primary}
          />
          <Text style={styles.badgeText}>Live-Dateien</Text>
        </View>
        {syncError ? (
          <View style={[styles.badge, styles.badgeError]}>
            <Ionicons
              name="warning-outline"
              size={14}
              color={theme.palette.error}
            />
            <Text style={[styles.badgeText, styles.badgeErrorText]}>
              {syncError}
            </Text>
          </View>
        ) : entryUri ? (
          <View style={[styles.badge, styles.badgeSuccess]}>
            <Ionicons
              name="checkmark-circle-outline"
              size={14}
              color={theme.palette.success}
            />
            <Text style={[styles.badgeText, styles.badgeSuccessText]}>Bereit</Text>
          </View>
        ) : (
          <View style={[styles.badge, styles.badgeWarning]}>
            <Ionicons
              name="hourglass-outline"
              size={14}
              color={theme.palette.warning}
            />
            <Text style={[styles.badgeText, styles.badgeWarningText]}>
              Auswahl benötigt
            </Text>
          </View>
        )}
      </View>

      {htmlEntries.length > 0 && (
        <ScrollView
          horizontal
          style={styles.entryScroll}
          contentContainerStyle={styles.entryScrollContent}
          showsHorizontalScrollIndicator={false}
        >
          {htmlEntries.map(path => (
            <TouchableOpacity
              key={path}
              style={[
                styles.entryChip,
                selectedEntry === path && styles.entryChipActive,
              ]}
              onPress={() => setSelectedEntry(path)}
            >
              <Ionicons
                name="document-text-outline"
                size={14}
                color={
                  selectedEntry === path
                    ? theme.palette.background
                    : theme.palette.text.secondary
                }
              />
              <Text
                style={[
                  styles.entryChipText,
                  selectedEntry === path && styles.entryChipTextActive,
                ]}
                numberOfLines={1}
              >
                {path}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {syncError && (
        <TouchableOpacity style={styles.syncErrorCard} onPress={forceResync}>
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={theme.palette.error}
          />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.syncErrorTitle}>Sync fehlgeschlagen</Text>
            <Text style={styles.syncErrorText}>{syncError}</Text>
          </View>
          <Ionicons
            name="refresh"
            size={18}
            color={theme.palette.text.secondary}
          />
        </TouchableOpacity>
      )}

      {hasHtmlEntry ? (
        entryUri ? (
          <WebView
            key={`webview-${webViewKey}`}
            ref={webViewRef}
            source={{ uri: entryUri }}
            style={styles.webview}
            onLoadEnd={handleLoadEnd}
            onError={handleError}
            onHttpError={handleHttpError}
            startInLoadingState
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            mixedContentMode="always"
            cacheEnabled
            cacheMode="LOAD_DEFAULT"
            onShouldStartLoadWithRequest={handleExternalNav}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator
                  size="large"
                  color={theme.palette.primary}
                />
              </View>
            )}
            androidLayerType="hardware"
            setBuiltInZoomControls={false}
            setDisplayZoomControls={false}
            scrollEnabled
            bounces={false}
          />
        ) : (
          <View style={styles.placeholder}>
            <ActivityIndicator size="large" color={theme.palette.primary} />
            <Text style={styles.placeholderText}>
              Vorschau wird vorbereitet …
            </Text>
          </View>
        )
      ) : (
        <View style={styles.infoWrapper}>
          <View style={styles.infoCard}>
            <Ionicons
              name={isReactNativeProject ? 'phone-portrait-outline' : 'eye-off-outline'}
              size={36}
              color={isReactNativeProject ? theme.palette.primary : theme.palette.text.secondary}
              style={{ marginBottom: 12 }}
            />
            <Text style={styles.infoTitle}>
              {isReactNativeProject 
                ? 'React Native Projekt erkannt' 
                : 'Keine HTML-Datei gefunden'}
            </Text>
            <Text style={styles.infoText}>
              {isReactNativeProject ? (
                <>
                  Für React Native Apps empfehlen wir <Text style={styles.highlight}>Expo Go</Text> auf deinem Handy.
                  Du kannst aber auch eine Web-Vorschau erstellen.
                </>
              ) : (
                <>
                  Lege eine <Text style={styles.highlight}>index.html</Text> oder eine andere
                  HTML-Datei im Projekt an. Sie wird automatisch auf das Gerät kopiert und mit
                  allen relativen Assets geladen.
                </>
              )}
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCreatePreviewHtml}
            >
              <Text style={styles.primaryButtonText}>
                {isReactNativeProject ? 'preview.html erstellen' : 'index.html erstellen'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={forceResync}>
              <Text style={styles.secondaryButtonText}>Erneut prüfen</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.hintCard}>
            <Text style={styles.hintTitle}>
              {isReactNativeProject ? 'Vorschau-Optionen' : 'Tipps für eine echte Preview'}
            </Text>
            {isReactNativeProject ? (
              <>
                <Text style={styles.hintText}>
                  • <Text style={styles.highlight}>Expo Go</Text>: Scanne den QR-Code nach `npm start`
                </Text>
                <Text style={styles.hintText}>
                  • <Text style={styles.highlight}>Web-Preview</Text>: Erstelle eine preview.html für eine schnelle Vorschau
                </Text>
                <Text style={styles.hintText}>
                  • <Text style={styles.highlight}>Build</Text>: Erstelle einen EAS Build für die echte App
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.hintText}>
                  • Verwende relative Pfade wie <Text style={styles.highlight}>./styles.css</Text> für Assets.
                </Text>
                <Text style={styles.hintText}>
                  • Bilder können als Base64 (<Text style={styles.highlight}>data:image</Text>) hinterlegt werden.
                </Text>
                <Text style={styles.hintText}>
                  • Nach jeder Änderung genügt ein Tipp auf "Dateien neu laden".
                </Text>
              </>
            )}
          </View>
        </View>
      )}

      {hasError && entryUri && (
        <TouchableOpacity style={styles.errorBanner} onPress={reloadWebView}>
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={theme.palette.error}
          />
          <Text style={styles.errorBannerText}>
            Vorschau konnte nicht geladen werden. Tippe zum Neuversuch.
          </Text>
        </TouchableOpacity>
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
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    paddingHorizontal: 24,
  },
  loadingText: {
    color: theme.palette.text.secondary,
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
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
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerInfo: {
    flex: 1,
    paddingRight: 8,
  },
  projectName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.palette.text.primary,
  },
  metaText: {
    marginTop: 4,
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    padding: 6,
    marginLeft: 4,
    borderRadius: 8,
    backgroundColor: theme.palette.card,
  },
  badgeRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginRight: 8,
    backgroundColor: theme.palette.card,
  },
  badgeText: {
    marginLeft: 6,
    fontSize: 11,
    color: theme.palette.text.secondary,
  },
  badgeSuccess: {
    borderColor: theme.palette.success,
    backgroundColor: 'rgba(0,255,0,0.08)',
  },
  badgeSuccessText: {
    color: theme.palette.success,
  },
  badgeWarning: {
    borderColor: theme.palette.warning,
    backgroundColor: 'rgba(255,200,0,0.12)',
  },
  badgeWarningText: {
    color: theme.palette.warning,
  },
  badgeError: {
    borderColor: theme.palette.error,
    backgroundColor: 'rgba(255,0,0,0.08)',
  },
  badgeErrorText: {
    color: theme.palette.error,
  },
  entryScroll: {
    maxHeight: 42,
    marginBottom: 8,
  },
  entryScrollContent: {
    paddingHorizontal: 12,
  },
  entryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.palette.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginHorizontal: 4,
    backgroundColor: theme.palette.card,
  },
  entryChipActive: {
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primary,
  },
  entryChipText: {
    marginLeft: 6,
    color: theme.palette.text.secondary,
    fontSize: 12,
  },
  entryChipTextActive: {
    color: theme.palette.background,
    fontWeight: '600',
  },
  infoWrapper: {
    flex: 1,
    padding: 24,
  },
  infoCard: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 16,
    backgroundColor: theme.palette.card,
    padding: 20,
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.palette.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  infoText: {
    color: theme.palette.text.secondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  highlight: {
    color: theme.palette.primary,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: theme.palette.primary,
  },
  primaryButtonText: {
    color: theme.palette.background,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  secondaryButtonText: {
    color: theme.palette.text.primary,
    fontWeight: '600',
  },
  hintCard: {
    marginTop: 20,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  hintTitle: {
    color: theme.palette.text.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  hintText: {
    color: theme.palette.text.secondary,
    fontSize: 13,
    marginBottom: 4,
  },
  syncErrorCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.error,
    backgroundColor: 'rgba(255,0,0,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncErrorTitle: {
    color: theme.palette.error,
    fontWeight: '600',
    fontSize: 13,
  },
  syncErrorText: {
    color: theme.palette.text.secondary,
    fontSize: 12,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  placeholderText: {
    marginTop: 12,
    color: theme.palette.text.secondary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderColor: theme.palette.border,
  },
  errorBannerText: {
    color: theme.palette.error,
    marginLeft: 8,
    fontSize: 13,
  },
});

export default React.memo(PreviewScreen);
