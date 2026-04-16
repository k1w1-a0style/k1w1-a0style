import React from 'react';
import { ActivityIndicator, Animated, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../theme';
import { getPreviewMixedContentMode } from '../../../hooks/previewHelpers';
import type { PreviewPhase } from '../hooks/usePreviewScreen';
import { s } from '../PreviewScreen.styles';

type PreviewSource = { type: 'url'; uri: string } | { type: 'html'; html: string } | null;

type DeviceFrameProps = {
  webViewRef: React.RefObject<WebView | null>;
  previewSource: PreviewSource;
  cycleId: number;
  phase: PreviewPhase;
  fadeAnim: Animated.Value;
  flashBorderAnim: Animated.Value;
  originWhitelist: string[];
  errorMessage?: string | null;
  onShouldStartLoadWithRequest: NonNullable<React.ComponentProps<typeof WebView>['onShouldStartLoadWithRequest']>;
  onLoadStart: (cycleId: number) => void;
  onLoadEnd: (cycleId: number) => void;
  onError: (cycleId: number, message: string) => void;
  onHttpError: (cycleId: number, statusCode: number | undefined) => void;
  onContentProcessDidTerminate: (event: { nativeEvent?: unknown }) => void;
  onRenderProcessGone: (event: { nativeEvent?: { didCrash?: boolean } }) => boolean;
  onCreate: () => void;
};

function getLoadingLabel(phase: PreviewPhase, previewSource: PreviewSource): string {
  if (phase === 'creating') return 'Primäre Remote-Preview wird angefragt…';
  if (previewSource?.type === 'html') return 'Lokaler Dev-Fallback lädt…';
  return 'Remote-Preview lädt…';
}

export function DeviceFrame({
  webViewRef,
  previewSource,
  cycleId,
  phase,
  fadeAnim,
  flashBorderAnim,
  originWhitelist,
  errorMessage,
  onShouldStartLoadWithRequest,
  onLoadStart,
  onLoadEnd,
  onError,
  onHttpError,
  onContentProcessDidTerminate,
  onRenderProcessGone,
  onCreate,
}: DeviceFrameProps) {
  const isBusy = phase === 'loading' || phase === 'creating';
  const showWebView = Boolean(previewSource) && phase !== 'error';
  const fallbackMessage = errorMessage?.trim() || null;
  const renderablePreviewSource = showWebView ? previewSource : null;

  return (
    <View style={s.previewArea} testID="preview-device-frame-shell">
      <Animated.View
        testID="preview-device-frame"
        style={[
          s.deviceFrame,
          {
            borderColor: flashBorderAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [theme.palette.border, theme.palette.primary, theme.palette.primary],
            }),
            shadowOpacity: flashBorderAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.9] }),
            shadowColor: flashBorderAnim.interpolate({ inputRange: [0, 1], outputRange: ['#000', theme.palette.primary] }),
            shadowRadius: flashBorderAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 24] }),
          },
        ]}
      >
        <View style={s.deviceNotch} />

        {renderablePreviewSource ? (
          <Animated.View
            testID="preview-webview-wrap"
            style={[s.webViewWrap, { opacity: phase === 'ready' ? fadeAnim : 1 }]}
          >
            <WebView
              ref={webViewRef}
              style={s.webView}
              source={
                renderablePreviewSource.type === 'url'
                  ? { uri: renderablePreviewSource.uri }
                  : { html: renderablePreviewSource.html }
              }
              originWhitelist={originWhitelist}
              setSupportMultipleWindows={false}
              javaScriptCanOpenWindowsAutomatically={false}
              onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
              onLoadStart={() => onLoadStart(cycleId)}
              onLoadEnd={() => onLoadEnd(cycleId)}
              onError={(event) => onError(cycleId, event.nativeEvent?.description || 'WebView Fehler')}
              onHttpError={(event) => onHttpError(cycleId, event.nativeEvent?.statusCode)}
              onContentProcessDidTerminate={onContentProcessDidTerminate}
              onRenderProcessGone={onRenderProcessGone}
              mixedContentMode={getPreviewMixedContentMode()}
              startInLoadingState={false}
            />
            {isBusy && (
              <View style={s.loadingOverlay} testID="preview-loading-overlay">
                <View style={s.loadingOverlayCard}>
                  <ActivityIndicator size="large" color={theme.palette.primary} />
                  <Text style={s.loadingOverlayText}>{getLoadingLabel(phase, renderablePreviewSource)}</Text>
                </View>
              </View>
            )}
          </Animated.View>
        ) : (
          <View style={s.emptyPreview} testID="preview-device-fallback">
            {phase === 'creating' ? (
              <>
                <ActivityIndicator size="large" color={theme.palette.primary} />
                <Text style={s.emptyPreviewText}>Primäre Remote-Preview wird erstellt…</Text>
              </>
            ) : phase === 'error' ? (
              <>
                <Ionicons name="warning-outline" size={48} color={theme.palette.error} />
                <Text style={s.emptyPreviewTitle}>Preview konnte nicht angezeigt werden</Text>
                <Text style={s.emptyPreviewText}>
                  {fallbackMessage ?? 'Die Preview ist derzeit nicht renderbar. Bitte neu laden oder erneut erstellen.'}
                </Text>
                <Pressable style={s.createBtn} onPress={onCreate}>
                  <Ionicons name="refresh-outline" size={16} color={theme.palette.primary} />
                  <Text style={s.createBtnText}>Preview neu laden</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Ionicons name="phone-portrait-outline" size={48} color={theme.palette.text.muted} />
                <Text style={s.emptyPreviewTitle}>Noch keine Preview</Text>
                <Text style={s.emptyPreviewText}>
                  {fallbackMessage ?? 'Erstelle eine Preview, damit hier statt einer leeren Fläche ein sichtbarer Inhalt geladen wird.'}
                </Text>
                <Pressable style={s.createBtn} onPress={onCreate}>
                  <Ionicons name="play-outline" size={16} color={theme.palette.primary} />
                  <Text style={s.createBtnText}>Remote-Preview erstellen</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        <View style={s.deviceBottom} />
      </Animated.View>
    </View>
  );
}
