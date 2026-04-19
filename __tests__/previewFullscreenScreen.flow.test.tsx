import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import PreviewFullscreenScreen from "../screens/PreviewFullscreenScreen";

const mockUsePreviewFullscreen = jest.fn();

jest.mock("../screens/PreviewFullscreenScreen/hooks/usePreviewFullscreen", () => ({
  usePreviewFullscreen: () => mockUsePreviewFullscreen(),
}));

jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    WebView: React.forwardRef((_props: unknown, _ref: unknown) => React.createElement(View, { testID: "mock-fullscreen-webview" })),
  };
});

describe("PreviewFullscreenScreen flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the invalid-preview guard and lets the user go back", () => {
    const handleGoBack = jest.fn();
    mockUsePreviewFullscreen.mockReturnValue({
      title: "Preview",
      url: null,
      html: null,
      baseUrl: null,
      mode: null,
      hasUrlParseError: false,
      originWhitelist: ["*"],
      loading: false,
      error: null,
      canGoBack: false,
      canGoForward: false,
      webViewRef: { current: null },
      handleGoBack,
      handleWebViewGoBack: jest.fn(),
      handleWebViewGoForward: jest.fn(),
      handleReload: jest.fn(),
      handleShare: jest.fn(),
      handleOpenExternal: jest.fn(),
      handleLoadStart: jest.fn(),
      handleLoadEnd: jest.fn(),
      handleNavigationStateChange: jest.fn(),
      handleShouldStartLoad: jest.fn(() => true),
      handleError: jest.fn(),
      handleHttpError: jest.fn(),
      handleContentProcessDidTerminate: jest.fn(),
      handleRenderProcessGone: jest.fn(),
      headerSubtitle: "",
    });

    const screen = render(<PreviewFullscreenScreen />);

    expect(screen.getByText("Keine gültige Preview")).toBeTruthy();
    fireEvent.press(screen.getAllByText("Zurück")[0]);
    expect(handleGoBack).toHaveBeenCalledTimes(1);
  });

  it("wires fullscreen toolbar actions for a valid URL preview", () => {
    const handleGoBack = jest.fn();
    const handleReload = jest.fn();
    const handleShare = jest.fn();
    const handleOpenExternal = jest.fn();

    mockUsePreviewFullscreen.mockReturnValue({
      title: "Preview",
      url: "https://preview.example.com",
      html: null,
      baseUrl: null,
      mode: "url",
      hasUrlParseError: false,
      originWhitelist: ["https://preview.example.com"],
      loading: false,
      error: null,
      canGoBack: false,
      canGoForward: false,
      webViewRef: { current: null },
      handleGoBack,
      handleWebViewGoBack: jest.fn(),
      handleWebViewGoForward: jest.fn(),
      handleReload,
      handleShare,
      handleOpenExternal,
      handleLoadStart: jest.fn(),
      handleLoadEnd: jest.fn(),
      handleNavigationStateChange: jest.fn(),
      handleShouldStartLoad: jest.fn(() => true),
      handleError: jest.fn(),
      handleHttpError: jest.fn(),
      handleContentProcessDidTerminate: jest.fn(),
      handleRenderProcessGone: jest.fn(),
      headerSubtitle: "Remote Preview",
    });

    const screen = render(<PreviewFullscreenScreen />);

    expect(screen.getByTestId("mock-fullscreen-webview")).toBeTruthy();
    fireEvent.press(screen.getAllByText("Zurück")[0]);
    fireEvent.press(screen.getByText("refresh"));
    fireEvent.press(screen.getByText("open-outline"));
    fireEvent.press(screen.getByText("share-outline"));

    expect(handleGoBack).toHaveBeenCalledTimes(1);
    expect(handleReload).toHaveBeenCalledTimes(1);
    expect(handleOpenExternal).toHaveBeenCalledTimes(1);
    expect(handleShare).toHaveBeenCalledTimes(1);
  });
});