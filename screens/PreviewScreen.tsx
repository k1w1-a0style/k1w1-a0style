/**
 * PreviewScreen.tsx
 * 
 * Bolt-Style Live-Preview für React Native Apps
 * Zeigt eine Vorschau des aktuellen Projekts in einem WebView
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';

type DeviceSize = 'mobile' | 'tablet' | 'desktop';
type Orientation = 'portrait' | 'landscape';

const DEVICE_SIZES: Record<DeviceSize, { width: number; height: number; label: string }> = {
  mobile: { width: 375, height: 667, label: '📱 Mobile' },
  tablet: { width: 768, height: 1024, label: '📱 Tablet' },
  desktop: { width: 1440, height: 900, label: '🖥️ Desktop' },
};

export default function PreviewScreen() {
  const { projectName, fileTree } = useProject();
  const [isLoading, setIsLoading] = useState(true);
  const [deviceSize, setDeviceSize] = useState<DeviceSize>('mobile');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [showDevTools, setShowDevTools] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scale, setScale] = useState(1);
  const webViewRef = useRef<WebView>(null);

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  // Berechne die Preview-Dimensionen basierend auf Device-Size und Orientation
  const getPreviewDimensions = useCallback(() => {
    const device = DEVICE_SIZES[deviceSize];
    const isLandscape = orientation === 'landscape';
    
    const width = isLandscape ? device.height : device.width;
    const height = isLandscape ? device.width : device.height;
    
    // Scale to fit screen
    const maxWidth = screenWidth - 40;
    const maxHeight = screenHeight - 300;
    const scaleX = maxWidth / width;
    const scaleY = maxHeight / height;
    const autoScale = Math.min(scaleX, scaleY, 1);
    
    return {
      width: width * autoScale * scale,
      height: height * autoScale * scale,
      deviceWidth: width,
      deviceHeight: height,
    };
  }, [deviceSize, orientation, screenWidth, screenHeight, scale]);

  const dimensions = getPreviewDimensions();

  // Generiere Preview-HTML aus dem Projekt
  const generatePreviewHTML = useCallback(() => {
    // Finde App.tsx oder App.js im FileTree
    const appFile = fileTree['App.tsx'] || fileTree['App.js'];
    
    if (!appFile || !projectName) {
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Preview</title>
            <style>
              body {
                margin: 0;
                padding: 20px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background: ${theme.palette.background};
                color: ${theme.palette.text.primary};
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
              }
              .message {
                text-align: center;
                padding: 40px;
                background: ${theme.palette.surface};
                border-radius: 12px;
                border: 1px solid ${theme.palette.border};
              }
              h1 {
                font-size: 24px;
                margin-bottom: 12px;
              }
              p {
                color: ${theme.palette.text.secondary};
                line-height: 1.6;
              }
            </style>
          </head>
          <body>
            <div class="message">
              <h1>⚠️ Kein Projekt geladen</h1>
              <p>Bitte lade ein React Native Projekt, um eine Vorschau anzuzeigen.</p>
            </div>
          </body>
        </html>
      `;
    }

    // Einfache Preview-HTML (in Produktion würde hier ein echter Expo Snack Embed o.ä. sein)
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${projectName} - Preview</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              padding: 20px;
            }
            .container {
              text-align: center;
              max-width: 600px;
            }
            .logo {
              font-size: 80px;
              margin-bottom: 20px;
              animation: bounce 2s infinite;
            }
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-20px); }
            }
            h1 {
              font-size: 32px;
              margin-bottom: 16px;
              font-weight: 700;
            }
            .subtitle {
              font-size: 18px;
              opacity: 0.9;
              margin-bottom: 40px;
            }
            .info-box {
              background: rgba(255, 255, 255, 0.1);
              backdrop-filter: blur(10px);
              border-radius: 16px;
              padding: 30px;
              margin-top: 40px;
              text-align: left;
            }
            .info-item {
              display: flex;
              align-items: center;
              margin-bottom: 16px;
              font-size: 14px;
            }
            .info-item:last-child {
              margin-bottom: 0;
            }
            .icon {
              font-size: 24px;
              margin-right: 12px;
            }
            .note {
              margin-top: 30px;
              font-size: 12px;
              opacity: 0.7;
              line-height: 1.6;
            }
            .device-frame {
              width: 100%;
              max-width: 400px;
              margin: 40px auto;
              background: white;
              border-radius: 30px;
              padding: 12px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            .screen {
              background: ${theme.palette.background};
              border-radius: 20px;
              padding: 40px 20px;
              min-height: 600px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              color: ${theme.palette.text.primary};
            }
            .app-name {
              font-size: 28px;
              font-weight: bold;
              margin-bottom: 16px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
            }
            .file-count {
              font-size: 14px;
              color: ${theme.palette.text.secondary};
              margin-bottom: 30px;
            }
            .feature-list {
              width: 100%;
              max-width: 300px;
            }
            .feature {
              background: ${theme.palette.surface};
              padding: 16px;
              margin-bottom: 12px;
              border-radius: 12px;
              border: 1px solid ${theme.palette.border};
              display: flex;
              align-items: center;
              gap: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">📱</div>
            <h1>${projectName}</h1>
            <p class="subtitle">Live Preview</p>
            
            <div class="device-frame">
              <div class="screen">
                <div class="app-name">${projectName}</div>
                <div class="file-count">
                  ${Object.keys(fileTree).length} Dateien geladen
                </div>
                
                <div class="feature-list">
                  <div class="feature">
                    <span style="font-size: 24px">⚡</span>
                    <div>
                      <div style="font-weight: 600; margin-bottom: 4px">React Native</div>
                      <div style="font-size: 12px; opacity: 0.7">Expo SDK 54</div>
                    </div>
                  </div>
                  
                  <div class="feature">
                    <span style="font-size: 24px">🎨</span>
                    <div>
                      <div style="font-weight: 600; margin-bottom: 4px">Modern UI</div>
                      <div style="font-size: 12px; opacity: 0.7">Native Components</div>
                    </div>
                  </div>
                  
                  <div class="feature">
                    <span style="font-size: 24px">🚀</span>
                    <div>
                      <div style="font-weight: 600; margin-bottom: 4px">Ready to Build</div>
                      <div style="font-size: 12px; opacity: 0.7">EAS Build Support</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="info-box">
              <div class="info-item">
                <span class="icon">ℹ️</span>
                <div>
                  <strong>Live-Preview</strong> zeigt eine Vorschau deiner App
                </div>
              </div>
              <div class="info-item">
                <span class="icon">🔄</span>
                <div>
                  Änderungen werden automatisch aktualisiert
                </div>
              </div>
              <div class="info-item">
                <span class="icon">📱</span>
                <div>
                  Teste verschiedene Bildschirmgrößen
                </div>
              </div>
            </div>
            
            <p class="note">
              💡 <strong>Hinweis:</strong> Für eine vollständige Live-Vorschau mit echter 
              React Native Rendering nutze Expo Snack oder EAS Update im Build-Screen.
            </p>
          </div>
        </body>
      </html>
    `;
  }, [projectName, fileTree]);

  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
    webViewRef.current?.reload();
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.1, 2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.1, 0.5));
  }, []);

  const handleResetZoom = useCallback(() => {
    setScale(1);
  }, []);

  const toggleOrientation = useCallback(() => {
    setOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait');
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>📱 Live Preview</Text>
          <Text style={styles.subtitle}>
            {projectName || 'Kein Projekt geladen'}
          </Text>
        </View>

        {/* Toolbar */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.toolbar}
          contentContainerStyle={styles.toolbarContent}
        >
          {/* Device Size Selector */}
          <View style={styles.toolbarGroup}>
            {(Object.keys(DEVICE_SIZES) as DeviceSize[]).map((size) => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.toolbarButton,
                  deviceSize === size && styles.toolbarButtonActive,
                ]}
                onPress={() => setDeviceSize(size)}
              >
                <Text
                  style={[
                    styles.toolbarButtonText,
                    deviceSize === size && styles.toolbarButtonTextActive,
                  ]}
                >
                  {DEVICE_SIZES[size].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.toolbarDivider} />

          {/* Orientation Toggle */}
          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={toggleOrientation}
          >
            <Ionicons
              name={orientation === 'portrait' ? 'phone-portrait' : 'phone-landscape'}
              size={18}
              color={theme.palette.primary}
            />
            <Text style={styles.toolbarButtonText}>
              {orientation === 'portrait' ? 'Portrait' : 'Landscape'}
            </Text>
          </TouchableOpacity>

          <View style={styles.toolbarDivider} />

          {/* Zoom Controls */}
          <TouchableOpacity style={styles.toolbarButton} onPress={handleZoomOut}>
            <Ionicons name="remove-circle-outline" size={18} color={theme.palette.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} onPress={handleResetZoom}>
            <Text style={styles.toolbarButtonText}>{Math.round(scale * 100)}%</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} onPress={handleZoomIn}>
            <Ionicons name="add-circle-outline" size={18} color={theme.palette.primary} />
          </TouchableOpacity>

          <View style={styles.toolbarDivider} />

          {/* Refresh Button */}
          <TouchableOpacity style={styles.toolbarButton} onPress={handleRefresh}>
            <Ionicons name="refresh" size={18} color={theme.palette.primary} />
            <Text style={styles.toolbarButtonText}>Refresh</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Preview */}
        <View style={styles.previewContainer}>
          <View
            style={[
              styles.deviceFrame,
              {
                width: dimensions.width,
                height: dimensions.height,
              },
            ]}
          >
            <View style={styles.deviceNotch} />
            <WebView
              key={refreshKey}
              ref={webViewRef}
              source={{ html: generatePreviewHTML() }}
              style={styles.webview}
              onLoadStart={() => setIsLoading(true)}
              onLoadEnd={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                Alert.alert('Fehler', 'Preview konnte nicht geladen werden');
              }}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              renderLoading={() => (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.palette.primary} />
                  <Text style={styles.loadingText}>Lade Vorschau...</Text>
                </View>
              )}
            />
            <View style={styles.deviceHomeIndicator} />
          </View>

          {/* Device Info */}
          <View style={styles.infoBar}>
            <Text style={styles.infoText}>
              {dimensions.deviceWidth} × {dimensions.deviceHeight} px
            </Text>
            <Text style={styles.infoText}>•</Text>
            <Text style={styles.infoText}>
              {DEVICE_SIZES[deviceSize].label}
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.palette.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.palette.text.secondary,
  },
  toolbar: {
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.surface,
  },
  toolbarContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  toolbarGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
  },
  toolbarButtonActive: {
    borderColor: theme.palette.primary,
    backgroundColor: theme.palette.primary + '15',
  },
  toolbarButtonText: {
    fontSize: 12,
    color: theme.palette.text.primary,
    fontWeight: '500',
  },
  toolbarButtonTextActive: {
    color: theme.palette.primary,
    fontWeight: '600',
  },
  toolbarDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.palette.border,
    marginHorizontal: 4,
  },
  previewContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: theme.palette.surface,
  },
  deviceFrame: {
    backgroundColor: '#1a1a1a',
    borderRadius: 40,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  deviceNotch: {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: [{ translateX: -60 }],
    width: 120,
    height: 30,
    backgroundColor: '#1a1a1a',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    zIndex: 10,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 30,
  },
  deviceHomeIndicator: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    transform: [{ translateX: -60 }],
    width: 120,
    height: 4,
    backgroundColor: '#ffffff40',
    borderRadius: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.palette.text.secondary,
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.palette.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  infoText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
