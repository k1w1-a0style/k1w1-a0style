import React from 'react';
import { Animated, ScrollView } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import PreviewScreen from '../screens/PreviewScreen/PreviewScreen';

const mockUsePreviewScreen = jest.fn();
const mockUseSafeAreaInsets = jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 }));

jest.mock('../screens/PreviewScreen/hooks/usePreviewScreen', () => ({
  usePreviewScreen: () => mockUsePreviewScreen(),
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: Record<string, unknown>) =>
      ReactLib.createElement(View, props, children),
    useSafeAreaInsets: () => mockUseSafeAreaInsets(),
  };
});

jest.mock('react-native-webview', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  const MockWebView = ReactLib.forwardRef((_props: Record<string, unknown>, _ref: unknown) =>
    ReactLib.createElement(View, { testID: 'mock-webview' }),
  );

  return { WebView: MockWebView, default: MockWebView };
});

function buildHookState(overrides: Record<string, unknown> = {}) {
  return {
    projectData: { name: 'Preview Demo' },
    isLoading: false,
    state: {
      isCreating: false,
      error: null,
      remoteFailure: null,
      fileCount: 4,
      totalSize: 4096,
      skippedCount: 0,
    },
    lastPreview: null,
    previewSource: { type: 'html', html: '<html><body>preview ok</body></html>' },
    previewKind: 'local',
    previewUrl: null,
    previewExpiryText: 'Kein Ablauf hinterlegt',
    previewChannelLabel: 'Lokaler HTML-/Eval-Fallback',
    transientLocalPreviewNotice: null,
    displayState: {
      kind: 'fallback_active',
      tone: 'warning',
      statusText: 'Lokaler Fallback aktiv',
      detailText: null,
      badgeText: 'Fallback',
    },
    runtimeHint: 'active=PreviewScreen source=local/html state=fallback_active phase=ready',
    qrImageUrl: null,
    phase: 'ready',
    setPhase: jest.fn(),
    webError: null,
    setWebError: jest.fn(),
    hotReloadEnabled: true,
    setHotReloadEnabled: jest.fn(),
    hotReloadCount: 0,
    pulseAnim: new Animated.Value(1),
    fadeAnim: new Animated.Value(1),
    hotDotAnim: new Animated.Value(1),
    flashBorderAnim: new Animated.Value(0),
    webViewRef: { current: null },
    originWhitelist: ['data:*', 'about:*', 'blob:*'],
    handleShouldStartLoad: jest.fn(() => true),
    handleContentProcessDidTerminate: jest.fn(),
    handleRenderProcessGone: jest.fn(() => true),
    resetRecoveryState: jest.fn(),
    handleCreate: jest.fn(),
    handleReset: jest.fn(),
    handleCopy: jest.fn(),
    handleCopyQrLink: jest.fn(),
    handleOpenQr: jest.fn(),
    handleOpenExternal: jest.fn(),
    handleFullscreen: jest.fn(),
    ...overrides,
  };
}

describe('PreviewScreen layout contract', () => {
  beforeEach(() => {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 390,
      height: 844,
      scale: 2,
      fontScale: 1,
    });
    mockUseSafeAreaInsets.mockReturnValue({ top: 0, right: 0, bottom: 0, left: 0 });
    mockUsePreviewScreen.mockReturnValue(buildHookState());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('keeps toolbar, device frame and bottom bar mounted in the stable main structure', () => {
    render(<PreviewScreen />);

    expect(screen.getByTestId('preview-toolbar')).toBeTruthy();
    expect(screen.getByTestId('preview-screen-scroll')).toBeTruthy();
    expect(screen.getByTestId('preview-screen-active-path')).toBeTruthy();
    expect(screen.getByTestId('preview-device-frame')).toBeTruthy();
    expect(screen.getByTestId('preview-bottom-bar')).toBeTruthy();
  });

  it('renders the main preview area when a preview source is available', () => {
    render(<PreviewScreen />);

    expect(screen.getByTestId('preview-webview-wrap')).toBeTruthy();
    expect(screen.getByTestId('mock-webview')).toBeTruthy();
    expect(screen.queryByTestId('preview-device-fallback')).toBeNull();
  });

  it('keeps the main scroll path fill-oriented on tall layouts so the device frame stays anchored above the bottom bar', () => {
    const view = render(<PreviewScreen />);
    const scrollView = view.UNSAFE_getByType(ScrollView);
    const activePath = screen.getByTestId('preview-screen-active-path');
    const mainContent = screen.getByTestId('preview-screen-main-content');
    const bottomBar = screen.getByTestId('preview-bottom-bar');

    expect(scrollView.props.contentInsetAdjustmentBehavior).toBe('never');
    expect(activePath.props.style).toEqual(
      expect.objectContaining({
        flexGrow: 1,
        justifyContent: 'space-between',
      }),
    );
    expect(mainContent.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          flexGrow: 1,
          flexShrink: 0,
          minHeight: 0,
        }),
      ]),
    );
    expect(bottomBar.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          marginTop: 'auto',
        }),
        expect.objectContaining({ paddingBottom: 10 }),
      ]),
    );
  });

  it('surfaces remoteFailure inside the visible preview meta contract', () => {
    mockUsePreviewScreen.mockReturnValue(
      buildHookState({
        state: {
          isCreating: false,
          error: null,
          remoteFailure: 'Preview-Server derzeit nicht erreichbar; lokale Fallback-Diagnose bleibt relevant.',
          fileCount: 4,
          totalSize: 4096,
          skippedCount: 0,
        },
        displayState: {
          kind: 'unavailable',
          tone: 'neutral',
          statusText: 'Remote-Preview nicht verfügbar',
          detailText: 'Preview-Server derzeit nicht erreichbar; lokale Fallback-Diagnose bleibt relevant.',
          badgeText: 'Nicht verfügbar',
        },
      }),
    );

    render(<PreviewScreen />);

    expect(screen.getByTestId('preview-meta-stack')).toBeTruthy();
    expect(screen.getByTestId('preview-remote-failure-card')).toBeTruthy();
    expect(screen.getByText('Fallback-/Remote-Diagnose')).toBeTruthy();
    expect(
      screen.getAllByText('Preview-Server derzeit nicht erreichbar; lokale Fallback-Diagnose bleibt relevant.'),
    ).toHaveLength(2);
  });

  it('uses a single bottom safe-area strategy so iOS inset padding is not applied twice', () => {
    mockUseSafeAreaInsets.mockReturnValue({ top: 0, right: 0, bottom: 34, left: 0 });

    const view = render(<PreviewScreen />);
    const scrollView = view.UNSAFE_getByType(ScrollView);
    const bottomBar = screen.getByTestId('preview-bottom-bar');

    expect(scrollView.props.contentInsetAdjustmentBehavior).toBe('never');
    expect(bottomBar.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ paddingBottom: 34 }),
      ]),
    );
  });

  it('keeps a vertical scroll path when the screen is short so meta and actions stay reachable', () => {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 375,
      height: 620,
      scale: 2,
      fontScale: 1,
    });
    mockUseSafeAreaInsets.mockReturnValue({ top: 0, right: 0, bottom: 18, left: 0 });
    mockUsePreviewScreen.mockReturnValue(
      buildHookState({
        state: {
          isCreating: false,
          error: null,
          remoteFailure: 'Kurzer Bildschirm braucht Scrollbarkeit für Diagnose und Actions.',
          fileCount: 4,
          totalSize: 4096,
          skippedCount: 0,
        },
        displayState: {
          kind: 'fallback_active',
          tone: 'warning',
          statusText: 'Lokaler Dev-Fallback aktiv',
          detailText: 'Kurzer Bildschirm braucht Scrollbarkeit für Diagnose und Actions.',
          badgeText: 'Dev-Fallback',
        },
      }),
    );

    const view = render(<PreviewScreen />);
    const scrollView = view.UNSAFE_getByType(ScrollView);

    expect(scrollView.props.showsVerticalScrollIndicator).toBe(true);
    expect(screen.getByTestId('preview-meta-stack')).toBeTruthy();
    expect(screen.getByTestId('preview-bottom-bar')).toBeTruthy();
    expect(screen.getByText('Neu erstellen')).toBeTruthy();
    expect(screen.getByText('Zurücksetzen')).toBeTruthy();
  });
});
