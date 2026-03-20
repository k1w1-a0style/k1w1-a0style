import React from "react";
import { Animated } from "react-native";
import { render } from "@testing-library/react-native";
import {
  getTransientPreviewNotice,
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

  it("keeps a transient local rehydration notice visible when provided", () => {
    expect(
      getTransientPreviewNotice(
        "Der letzte lokale HTML-/Eval-Fallback war nur temporär und ist nach Restart/Rehydration nicht mehr verfügbar. Bitte die primäre Remote-Preview neu erstellen.",
      ),
    ).toContain("nur temporär");
  });
});
