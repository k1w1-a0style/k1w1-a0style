import React from "react";
import { render } from "@testing-library/react-native";

import { PrivacySection } from "../screens/SettingsScreen/components/PrivacySection";

describe("PrivacySection scope label", () => {
  it("shows explicit project-only persistence scope", () => {
    const { getByText } = render(
      <PrivacySection
        persistChatHistory
        retentionLimit={200}
        retentionInput="200"
        onRetentionInputChange={jest.fn()}
        onSaveRetention={jest.fn()}
        onTogglePersist={jest.fn()}
      />,
    );

    expect(getByText(/Scope:/)).toBeTruthy();
    expect(getByText(/pro Projekt/)).toBeTruthy();
    expect(getByText(/kein globales, projektübergreifendes Gedächtnis/)).toBeTruthy();
  });
});
