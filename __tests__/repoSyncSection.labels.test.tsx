import React from "react";
import { render } from "@testing-library/react-native";
import { RepoSyncSection } from "../screens/GitHubReposScreen/components/RepoSyncSection";

describe("RepoSyncSection labels", () => {
  it("communicates sync modes clearly", () => {
    const { getByText } = render(
      <RepoSyncSection
        activeRepo="owner/repo"
        activeBranch="main"
        hasLocalFiles
        isPulling={false}
        isPushing={false}
        pullProgress=""
        onPull={() => undefined}
        onPush={() => undefined}
      />,
    );

    expect(getByText("Pull (Dialog)")).toBeTruthy();
    expect(getByText("Push (Merge)")).toBeTruthy();
    expect(getByText(/Full Sync \(Mirror\)/)).toBeTruthy();
  });
});
