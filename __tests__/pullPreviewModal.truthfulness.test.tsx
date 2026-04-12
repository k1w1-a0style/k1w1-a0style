import React from "react";
import { render } from "@testing-library/react-native";
import { PullPreviewModal } from "../screens/GitHubReposScreen/components/PullPreviewModal";

describe("PullPreviewModal truthfulness copy", () => {
  it("shows explicit merge/mirror wording and destructive note", () => {
    const { getByText } = render(
      <PullPreviewModal
        visible
        loading={false}
        pullProgress=""
        busy={false}
        onCancel={() => undefined}
        onOverwrite={() => undefined}
        onSkipConflicts={() => undefined}
        onMirror={() => undefined}
        preview={{
          remote: [{ path: "App.tsx", content: "x" }],
          conflicts: ["App.tsx"],
          remoteOnly: ["README.md"],
          updates: [],
        }}
      />,
    );

    expect(getByText("Merge Skip")).toBeTruthy();
    expect(getByText("Merge Overwrite")).toBeTruthy();
    expect(getByText("Full Sync / Mirror")).toBeTruthy();
    expect(getByText(/destruktiv, nur mit Bestätigung/)).toBeTruthy();
  });
});
