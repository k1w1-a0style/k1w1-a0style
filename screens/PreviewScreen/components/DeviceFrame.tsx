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
  phase: PreviewPhase;
  fadeAnim: Animated.Value;
  flashBorderAnim: Animated.Value;
  originWhitelist: string[];
  onShouldStartLoadWithRequest: NonNullable<React.ComponentProps<typeof WebView>['onShouldStartLoadWithRequest']>;
  onLoadStart: () => void;
  onLoadEnd: () => void;
  onError: (message: string) => void;
  onHttpError: (statusCode: number | undefined) => void;
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
  phase,
  fadeAnim,
  flashBorderAnim,
  originWhitelist,
  onShouldStartLoadWithRequest,
  onLoadStart,
  onLoadEnd,
  onError,
  onHttpError,
  onContentProcessDidTerminate,
  onRenderProcessGone,
  onCreate,
}: DeviceFrameProps) {
  return (
    <View style={s.previewArea}>
      <Animated.View
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

        {previewSource ? (
          <Animated.View style={[s.webViewWrap, { opacity: phase === 'ready' ? fadeAnim : 0.3 }]}>
            <WebView
              ref={webViewRef}
              style={s.webView}
              source={previewSource.type === 'url' ? { uri: previewSource.uri } : { html: previewSource.html }}
              originWhitelist={originWhitelist}
              setSupportMultipleWindows={false}
              javaScriptCanOpenWindowsAutomatically={false}
              onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
              onLoadStart={onLoadStart}
              onLoadEnd={onLoadEnd}
              onError={(event) => onError(event.nativeEvent?.description || 'WebView Fehler')}
              onHttpError={(event) => onHttpError(event.nativeEvent?.statusCode)}
              onContentProcessDidTerminate={onContentProcessDidTerminate}
              onRenderProcessGone={onRenderProcessGone}
              mixedContentMode={getPreviewMixedContentMode()}
              startInLoadingState={false}
            />
            {(phase === 'loading' || phase === 'creating') && (
              <View style={s.loadingOverlay}>
                <ActivityIndicator size="large" color={theme.palette.primary} />
                <Text style={s.loadingOverlayText}>{getLoadingLabel(phase, previewSource)}</Text>
              </View>
            )}
          </Animated.View>
        ) : (
          <View style={s.emptyPreview}>
            {phase === 'creating' ? (
              <>
                <ActivityIndicator size="large" color={theme.palette.primary} />
                <Text style={s.emptyPreviewText}>Primäre Remote-Preview wird erstellt…</Text>
              </>
            ) : (
              <>
                <Ionicons name="phone-portrait-outline" size={48} color={theme.palette.text.muted} />
                <Text style={s.emptyPreviewText}>Noch keine Preview</Text>
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
