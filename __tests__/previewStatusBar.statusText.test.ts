import React from "react";
import { Animated, Text } from "react-native";
import { render } from "@testing-library/react-native";
import {
  getTransientPreviewNotice,
  shouldClampPreviewNotice,
} from "../screens/PreviewScreen/components/PreviewStatusBar";
import { PreviewStatusBar } from "../screens/PreviewScreen/components/PreviewStatusBar";
import { resolvePreviewDisplayState } from "../hooks/previewHelpers";

describe("PreviewStatusBar status text semantics", () => {
  it("marks local fallback visibly as fallback and restricted state", () => {
    const displayState = resolvePreviewDisplayState({
      phase: "ready",
      previewKind: "local",
      previewSourceType: "html",
      remoteUrlStatus: "missing",
      hasExpiredRemoteUrl: false,
      remoteFailure: "Preview-Server derzeit nicht erreichbar.",
      stateError: null,
      webError: null,
      transientLocalPreviewNotice: null,
    });

    const screen = render(
      React.createElement(PreviewStatusBar, {
        phase: "ready",
        compact: false,
        runtimeHint: "active=PreviewScreen source=local/html state=fallback_active phase=ready",
        displayState,
        previewChannelLabel: "Lokaler HTML-/Eval-Fallback (nur Dev/Best-Effort, nur solange App aktiv ist)",
        previewExpiryText: "Kein Ablauf hinterlegt (letzter bekannter Stand)",
        transientLocalPreviewNotice: null,
        pulseAnim: new Animated.Value(1),
        hotReloadEnabled: false,
        hotReloadCount: 0,
        fileCount: 2,
        totalSize: 1024,
        skippedCount: 0,
      }),
    );

    expect(screen.getByText("Lokaler Dev-Fallback aktiv")).toBeTruthy();
    expect(screen.getByText("Dev-Fallback")).toBeTruthy();
    expect(
      screen.getByText("Preview-Server derzeit nicht erreichbar."),
    ).toBeTruthy();
  });

  it("does not clamp the only fallback diagnosis in compact mode", () => {
    const remoteFailure =
      "Die Remote-Preview konnte nicht erstellt werden, weil der Preview-Server keine verlässliche URL geliefert hat und der lokale Fallback nur Best-Effort ist.";
    const displayState = resolvePreviewDisplayState({
      phase: "ready",
      previewKind: "local",
      previewSourceType: "html",
      remoteUrlStatus: "missing",
      hasExpiredRemoteUrl: false,
      remoteFailure,
      stateError: null,
      webError: null,
      transientLocalPreviewNotice: null,
    });

    const screen = render(
      React.createElement(PreviewStatusBar, {
        phase: "ready",
        compact: true,
        runtimeHint: "active=PreviewScreen source=local/html state=fallback_active phase=ready",
        displayState,
        previewChannelLabel: "Lokaler HTML-/Eval-Fallback",
        previewExpiryText: "Kein Ablauf hinterlegt",
        transientLocalPreviewNotice: null,
        pulseAnim: new Animated.Value(1),
        hotReloadEnabled: false,
        hotReloadCount: 0,
        fileCount: 2,
        totalSize: 1024,
        skippedCount: 0,
      }),
    );

    const noticeText = screen.UNSAFE_getAllByType(Text).find(
      (node) => node.props.children === remoteFailure,
    );

    expect(shouldClampPreviewNotice(true, displayState.kind)).toBeUndefined();
    expect(noticeText?.props.numberOfLines).toBeUndefined();
  });

  it("keeps a transient local rehydration notice visible when provided", () => {
    expect(
      getTransientPreviewNotice(
        "Der letzte lokale HTML-/Eval-Fallback war nur temporär und ist nach Restart/Rehydration nicht mehr verfügbar. Bitte die primäre Remote-Preview neu erstellen.",
      ),
    ).toContain("nur temporär");
  });
});
