import React from "react";
import { render, act } from "@testing-library/react-native";

import { WebCodeEditor } from "../screens/CodeScreen/components/WebCodeEditor";

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

describe("WebCodeEditor crash recovery wiring", () => {
  beforeEach(() => {
    webViewPropsStore.length = 0;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("wires process-crash handlers and remounts after crash signal", () => {
    const onChangeText = jest.fn();
    render(<WebCodeEditor value={"const x = 1;"} onChangeText={onChangeText} />);

    const latestProps = webViewPropsStore[webViewPropsStore.length - 1] as {
      onRenderProcessGone?: (evt: { nativeEvent?: { didCrash?: boolean } }) => boolean;
      onContentProcessDidTerminate?: (evt: { nativeEvent?: unknown }) => void;
    };

    expect(typeof latestProps.onContentProcessDidTerminate).toBe("function");
    expect(typeof latestProps.onRenderProcessGone).toBe("function");

    act(() => {
      const handled = latestProps.onRenderProcessGone?.({ nativeEvent: { didCrash: true } });
      expect(handled).toBe(true);
      jest.advanceTimersByTime(1100);
    });

    // Re-render happened and still carries crash handlers after recovery path.
    const afterCrashProps = webViewPropsStore[webViewPropsStore.length - 1] as {
      onRenderProcessGone?: unknown;
      onContentProcessDidTerminate?: unknown;
    };
    expect(typeof afterCrashProps.onContentProcessDidTerminate).toBe("function");
    expect(typeof afterCrashProps.onRenderProcessGone).toBe("function");
  });
});
