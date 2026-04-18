import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import { PrivacySection } from "../screens/SettingsScreen/components/PrivacySection";
import { QualitySection } from "../screens/SettingsScreen/components/QualitySection";

describe("Settings sections flow", () => {
  it("wires privacy retention save and persistence toggle", () => {
    const onTogglePersist = jest.fn();
    const onSaveRetention = jest.fn();
    const onRetentionInputChange = jest.fn();

    const screen = render(
      <PrivacySection
        persistChatHistory
        retentionLimit={200}
        retentionInput="200"
        onRetentionInputChange={onRetentionInputChange}
        onSaveRetention={onSaveRetention}
        onTogglePersist={onTogglePersist}
      />,
    );

    fireEvent(screen.getByDisplayValue("200"), "changeText", "250");
    fireEvent(screen.getByTestId("settings-privacy-persist-switch"), "valueChange", false);
    fireEvent.press(screen.getByTestId("settings-privacy-save-retention-button"));

    expect(onRetentionInputChange).toHaveBeenCalledWith("250");
    expect(onTogglePersist).toHaveBeenCalledWith(false);
    expect(onSaveRetention).toHaveBeenCalledTimes(1);
  });

  it("wires quality mode selection across the visible buttons", () => {
    const onSetQuality = jest.fn();
    const screen = render(
      <QualitySection
        qualityMode="balanced"
        limitInfo="Alles grün"
        onSetQuality={onSetQuality}
      />,
    );

    fireEvent.press(screen.getByTestId("settings-quality-speed-button"));
    fireEvent.press(screen.getByTestId("settings-quality-quality-button"));
    fireEvent.press(screen.getByTestId("settings-quality-review-button"));

    expect(onSetQuality).toHaveBeenNthCalledWith(1, "speed");
    expect(onSetQuality).toHaveBeenNthCalledWith(2, "quality");
    expect(onSetQuality).toHaveBeenNthCalledWith(3, "review");
  });
});