import React from "react";
import { Animated } from "react-native";
import { render } from "@testing-library/react-native";
import { DeviceFrame } from "../screens/PreviewScreen/components/DeviceFrame";

const webViewPropsStore: Array<Record<string, unknown>> = [];

jest.mock("react-native-webview", () => {
  const ReactLib = require("react");
  const { View } = require("react-native");
  const MockWebView = ReactLib.forwardRef((props: Record<string, unknown>, _ref: unknown) => {
    webViewPropsStore.push(props);
    return ReactLib.createElement(View, { testID: "mock-webview" });
  });

  return { WebView: MockWebView, default: MockWebView };
});

describe("Preview WebView contract", () => {
  const baseProps = {
    webViewRef: { current: null },
    phase: "ready" as const,
    fadeAnim: new Animated.Value(1),
    flashBorderAnim: new Animated.Value(0),
    originWhitelist: ["https://preview.example.com", "https://preview.example.com/*", "data:*"],
    onShouldStartLoadWithRequest: jest.fn(() => true),
    onLoadStart: jest.fn(),
    onLoadEnd: jest.fn(),
    onError: jest.fn(),
    onHttpError: jest.fn(),
    onContentProcessDidTerminate: jest.fn(),
    onRenderProcessGone: jest.fn(() => true),
    onCreate: jest.fn(),
  };

  beforeEach(() => {
    webViewPropsStore.length = 0;
  });

  test("locks preview mixed content down to the minimal hardened setting", () => {
    render(
      <DeviceFrame
        {...baseProps}
        previewSource={{ type: "url", uri: "https://preview.example.com/app" }}
      />,
    );

    const latestProps = webViewPropsStore[webViewPropsStore.length - 1] as {
      mixedContentMode?: string;
      originWhitelist?: string[];
    };

    expect(latestProps.mixedContentMode).toBe("never");
    expect(latestProps.originWhitelist).toContain("https://preview.example.com");
  });

  test("keeps legitimate local html preview rendering under the hardened WebView policy", () => {
    render(
      <DeviceFrame
        {...baseProps}
        previewSource={{ type: "html", html: "<html><body>local fallback</body></html>" }}
      />,
    );

    const latestProps = webViewPropsStore[webViewPropsStore.length - 1] as {
      mixedContentMode?: string;
      source?: { html?: string };
    };

    expect(latestProps.mixedContentMode).toBe("never");
    expect(latestProps.source).toEqual({ html: "<html><body>local fallback</body></html>" });
  });

  test("shows an explicit fallback state instead of leaving a dark empty surface on preview errors", () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <DeviceFrame
        {...baseProps}
        phase="error"
        errorMessage="HTTP 500"
        previewSource={{ type: "url", uri: "https://preview.example.com/app" }}
      />,
    );

    expect(getByTestId("preview-device-fallback")).toBeTruthy();
    expect(getByText("Preview konnte nicht angezeigt werden")).toBeTruthy();
    expect(getByText("HTTP 500")).toBeTruthy();
    expect(queryByTestId("mock-webview")).toBeNull();
  });

  test("keeps the preview WebView mounted while loading so successful sources remain visible", () => {
    const { getByTestId } = render(
      <DeviceFrame
        {...baseProps}
        phase="loading"
        previewSource={{ type: "url", uri: "https://preview.example.com/app" }}
      />,
    );

    expect(getByTestId("mock-webview")).toBeTruthy();
    expect(getByTestId("preview-loading-overlay")).toBeTruthy();
  });
});
