import React from "react";
import { render } from "@testing-library/react-native";
import { Animated } from "react-native";

import ChatComposer from "../components/chat/ChatComposer";

describe("ChatComposer guard badge", () => {
  const baseProps = {
    textInput: "",
    onChangeText: jest.fn(),
    pendingPlan: null,
    selectedFileAsset: null,
    onPickDocument: jest.fn(),
    onClearSelectedFile: jest.fn(),
    onSend: jest.fn(),
    combinedIsLoading: false,
    keyboardOffsetInScreen: 0,
    sendButtonScale: new Animated.Value(1),
  } as const;

  it("shows normal write badge by default", () => {
    const { getByText } = render(<ChatComposer {...baseProps} />);
    expect(getByText("Normal write")).toBeTruthy();
  });

  it("shows guarded badge when status is guarded", () => {
    const { getByText } = render(<ChatComposer {...baseProps} guardWriteStatus="guarded" />);
    expect(getByText("Guarded path enthalten")).toBeTruthy();
  });

  it("shows staged badge and block-1 hint when pending plan is staged", () => {
    const { getByText } = render(
      <ChatComposer
        {...baseProps}
        pendingPlan={{ originalRequest: "x", planText: "y", mode: "staged" }}
      />,
    );

    expect(getByText("Stufenmodus · wartet auf Block 1")).toBeTruthy();
    expect(getByText(/Starte mit "block 1" oder "weiter"/)).toBeTruthy();
  });
});
