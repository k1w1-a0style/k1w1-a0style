import React from "react";
import { render } from "@testing-library/react-native";
import { HeaderSection } from "../screens/GitHubReposScreen/components/HeaderSection";

describe("GitHubRepos Header partial sync label", () => {
  it("does not show clean when sync status is partial", () => {
    const { queryByText, getByText } = render(
      <HeaderSection
        userLogin="tester"
        activeRepo="owner/repo"
        activeBranch="main"
        onNewRepo={() => undefined}
        onRefresh={() => undefined}
        onCheckStatus={() => undefined}
        syncStatus={{
          checking: false,
          modified: 0,
          localOnly: 0,
          remoteOnly: 0,
          remoteOnlyIsExact: false,
          remoteOnlyUnknownDueToLocalTruncation: true,
          dirtyLowerBound: 0,
          hasUncertainDirtyCount: true,
          skipped: 0,
          error: 0,
          checkedLocalFiles: 40,
          totalLocalFiles: 80,
          isPartial: true,
          partialReason: "Nur 40/80 lokale Dateien geprüft.",
          countsAreLowerBounds: true,
          checkedAt: Date.now(),
        }}
      />,
    );

    expect(queryByText("clean")).toBeNull();
    expect(getByText("teilweise geprüft")).toBeTruthy();
  });

  it("shows lower-bound dirty count on partial dirty status", () => {
    const { getByText } = render(
      <HeaderSection
        userLogin="tester"
        activeRepo="owner/repo"
        activeBranch="main"
        onNewRepo={() => undefined}
        onRefresh={() => undefined}
        onCheckStatus={() => undefined}
        syncStatus={{
          checking: false,
          modified: 1,
          localOnly: 0,
          remoteOnly: 2,
          remoteOnlyIsExact: false,
          remoteOnlyUnknownDueToLocalTruncation: true,
          dirtyLowerBound: 1,
          hasUncertainDirtyCount: true,
          skipped: 0,
          error: 0,
          checkedLocalFiles: 40,
          totalLocalFiles: 80,
          isPartial: true,
          partialReason: "Nur 40/80 lokale Dateien geprüft.",
          countsAreLowerBounds: true,
          checkedAt: Date.now(),
        }}
      />,
    );

    expect(getByText("dirty ≥1")).toBeTruthy();
  });

  it("avoids fake ≥N when no provable lower bound exists", () => {
    const { getByText, queryByText } = render(
      <HeaderSection
        userLogin="tester"
        activeRepo="owner/repo"
        activeBranch="main"
        onNewRepo={() => undefined}
        onRefresh={() => undefined}
        onCheckStatus={() => undefined}
        syncStatus={{
          checking: false,
          modified: 0,
          localOnly: 0,
          remoteOnly: 5,
          remoteOnlyIsExact: false,
          remoteOnlyUnknownDueToLocalTruncation: true,
          dirtyLowerBound: 0,
          hasUncertainDirtyCount: true,
          skipped: 0,
          error: 0,
          checkedLocalFiles: 40,
          totalLocalFiles: 80,
          isPartial: true,
          partialReason: "Abweichungen im Teilumfang gefunden. Kein Full-Sync-Schluss möglich.",
          countsAreLowerBounds: false,
          checkedAt: Date.now(),
        }}
      />,
    );

    expect(getByText("Abweichungen gefunden")).toBeTruthy();
    expect(queryByText(/dirty ≥/)).toBeNull();
  });
});
