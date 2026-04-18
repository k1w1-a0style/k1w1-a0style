import React from "react";
import { Animated } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";

import PreviewScreen from "../screens/PreviewScreen";

const mockUsePreviewScreen = jest.fn();

jest.mock("../screens/PreviewScreen/hooks/usePreviewScreen", () => ({
  usePreviewScreen: () => mockUsePreviewScreen(),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement(View, props, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

describe("PreviewScreen flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("wires toolbar and bottom-bar actions for a valid preview", () => {
    const handleReload = jest.fn();
    const handleCopy = jest.fn();
    const handleOpenExternal = jest.fn();
    const handleFullscreen = jest.fn();
    const handleCreate = jest.fn();
    const handleReset = jest.fn();

    mockUsePreviewScreen.mockReturnValue({
      projectData: { name: "Demo Preview" },
      isLoading: false,
      state: { fileCount: 3, totalSize: 1200, skippedCount: 0, error: null, remoteFailure: null, isCreating: false },
      previewSource: { type: "url", uri: "https://preview.example.com" },
      previewUrl: "https://preview.example.com#secret=abc",
      previewUrlDisplay: "preview.example.com#secret=••••",
      previewExpiryText: "läuft bald ab",
      canOpenFullscreen: true,
      previewChannelLabel: "Remote-Preview",
      transientLocalPreviewNotice: null,
      displayState: { kind: "remote_ready" },
      runtimeHint: "active=PreviewScreen",
      phase: "ready",
      previewCycleId: 1,
      webError: null,
      hotReloadEnabled: true,
      setHotReloadEnabled: jest.fn(),
      hotReloadCount: 0,
      pulseAnim: new Animated.Value(1),
      fadeAnim: new Animated.Value(1),
      hotDotAnim: new Animated.Value(1),
      flashBorderAnim: new Animated.Value(0),
      webViewRef: { current: null },
      originWhitelist: ["https://preview.example.com"],
      handleShouldStartLoad: jest.fn(() => true),
      handleContentProcessDidTerminate: jest.fn(),
      handleRenderProcessGone: jest.fn(),
      handleReload,
      handleCreate,
      handleReset,
      handleLoadStart: jest.fn(),
      handleLoadEnd: jest.fn(),
      handleLoadError: jest.fn(),
      handleHttpError: jest.fn(),
      handleCopy,
      handleOpenExternal,
      handleFullscreen,
    });

    const screen = render(<PreviewScreen />);

    fireEvent.press(screen.getByLabelText("Preview neu laden"));
    fireEvent.press(screen.getByLabelText("Preview-Link kopieren"));
    fireEvent.press(screen.getByLabelText("Preview im Browser öffnen"));
    fireEvent.press(screen.getByLabelText("Preview fullscreen öffnen"));
    fireEvent.press(screen.getByText("Neu erstellen"));
    fireEvent.press(screen.getByText("Zurücksetzen"));

    expect(handleReload).toHaveBeenCalledTimes(1);
    expect(handleCopy).toHaveBeenCalledTimes(1);
    expect(handleOpenExternal).toHaveBeenCalledTimes(1);
    expect(handleFullscreen).toHaveBeenCalledTimes(1);
    expect(handleCreate).toHaveBeenCalledTimes(1);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });

  it("renders the empty-state guard when no project is loaded", () => {
    mockUsePreviewScreen.mockReturnValue({
      projectData: null,
      isLoading: false,
    });

    const screen = render(<PreviewScreen />);

    expect(screen.getByText("Kein Projekt geladen")).toBeTruthy();
    expect(screen.getByText("Öffne oder erstelle zuerst ein Projekt.")).toBeTruthy();
  });
});