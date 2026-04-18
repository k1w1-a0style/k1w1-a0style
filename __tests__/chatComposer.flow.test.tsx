import React from "react";
import { Animated } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";

import ChatComposer from "../components/chat/ChatComposer";

describe("ChatComposer flow", () => {
  const baseProps = {
    textInput: "Bitte ändere den Header",
    onChangeText: jest.fn(),
    pendingPlan: null,
    selectedFileAsset: null,
    onPickDocument: jest.fn(),
    onClearSelectedFile: jest.fn(),
    onSend: jest.fn(),
    onAbort: jest.fn(),
    combinedIsLoading: false,
    keyboardOffsetInScreen: 0,
    sendButtonScale: new Animated.Value(1),
  } as const;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends when text is present and opens the attachment picker on demand", () => {
    const screen = render(<ChatComposer {...baseProps} />);

    fireEvent.press(screen.getByTestId("chat-composer-attach-button"));
    fireEvent.press(screen.getByTestId("chat-composer-send-button"));

    expect(baseProps.onPickDocument).toHaveBeenCalledTimes(1);
    expect(baseProps.onSend).toHaveBeenCalledTimes(1);
  });

  it("aborts while loading and lets the user clear an attached file", () => {
    const onAbort = jest.fn();
    const onClearSelectedFile = jest.fn();

    const screen = render(
      <ChatComposer
        {...baseProps}
        textInput=""
        selectedFileAsset={{ name: "spec.pdf" }}
        onAbort={onAbort}
        onClearSelectedFile={onClearSelectedFile}
        combinedIsLoading
      />,
    );

    fireEvent.press(screen.getByTestId("chat-composer-clear-attachment-button"));
    fireEvent.press(screen.getByTestId("chat-composer-abort-button"));

    expect(onClearSelectedFile).toHaveBeenCalledTimes(1);
    expect(onAbort).toHaveBeenCalledTimes(1);
  });
});