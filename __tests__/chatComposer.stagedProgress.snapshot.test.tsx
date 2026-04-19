import React from "react";
import { Animated } from "react-native";
import { render } from "@testing-library/react-native";

import ChatComposer from "../components/chat/ChatComposer";

describe("ChatComposer staged progress snapshots", () => {
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

  it("matches staged block-1 snapshot", () => {
    const { toJSON } = render(
      <ChatComposer
        {...baseProps}
        pendingPlan={{
          originalRequest: "große aufgabe",
          planText: "Block 1\nBlock 2\nBlock 3",
          mode: "staged",
          stagedLastBlockIndex: 0,
          stagedNextBlockIndex: 1,
          stagedTotalBlocks: 3,
        }}
      />,
    );
    const tree = toJSON();

    expect(tree).toMatchSnapshot();
  });

  it("matches staged block-2 snapshot", () => {
    const { toJSON } = render(
      <ChatComposer
        {...baseProps}
        pendingPlan={{
          originalRequest: "große aufgabe",
          planText: "Block 1\nBlock 2\nBlock 3",
          mode: "staged",
          stagedLastBlockIndex: 1,
          stagedNextBlockIndex: 2,
          stagedTotalBlocks: 3,
        }}
      />,
    );
    const tree = toJSON();

    expect(tree).toMatchSnapshot();
  });
});
