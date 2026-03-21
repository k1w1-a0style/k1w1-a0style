import React from 'react';
import { Animated } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import PreviewScreen from '../screens/PreviewScreen/PreviewScreen';

const mockUsePreviewScreen = jest.fn();

jest.mock('../screens/PreviewScreen/hooks/usePreviewScreen', () => ({
  usePreviewScreen: () => mockUsePreviewScreen(),
}));

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
    mockUsePreviewScreen.mockReturnValue(buildHookState());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('keeps toolbar, device frame and bottom bar mounted in the stable main structure', () => {
    render(<PreviewScreen />);

    expect(screen.getByTestId('preview-toolbar')).toBeTruthy();
    expect(screen.getByTestId('preview-device-frame')).toBeTruthy();
    expect(screen.getByTestId('preview-bottom-bar')).toBeTruthy();
  });

  it('renders the main preview area when a preview source is available', () => {
    render(<PreviewScreen />);

    expect(screen.getByTestId('preview-webview-wrap')).toBeTruthy();
    expect(screen.getByTestId('mock-webview')).toBeTruthy();
    expect(screen.queryByTestId('preview-device-fallback')).toBeNull();
  });
});
