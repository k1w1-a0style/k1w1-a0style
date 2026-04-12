import React from "react";
import { render } from "@testing-library/react-native";
import { LocalRemoteDiffSection } from "../screens/GitHubReposScreen/components/LocalRemoteDiffSection";

const mockUseLocalRemoteDiffModel = jest.fn();

jest.mock("../screens/GitHubReposScreen/components/LocalRemoteDiffSection/useLocalRemoteDiffModel", () => ({
  useLocalRemoteDiffModel: (...args: unknown[]) => mockUseLocalRemoteDiffModel(...args),
}));

const baseModel = {
  parsed: { owner: "owner", repo: "repo" },
  branch: "main",
  local: [{ path: "App.tsx", content: "x" }],
  loading: false,
  note: "",
  items: [{ path: "App.tsx", status: "modified" as const }],
  visibleItems: [{ path: "App.tsx", status: "modified" as const }],
  showAll: false,
  inlineMode: true,
  selected: {},
  selectedCount: 0,
  pushablePaths: [],
  inlineOpenAll: false,
  inlineOpenPath: null,
  inlineLoadingPath: null,
  preview: { open: false, path: "", status: "same" as const, loading: false, local: "", remote: "", diff: "" },
  previewCacheRef: { current: new Map() },
  getPreviewCacheKey: () => "key",
  setInlineMode: jest.fn(),
  setShowAll: jest.fn(),
  setInlineOpenPath: jest.fn(),
  setInlineLoadingPath: jest.fn(),
  collapseAllInline: jest.fn(),
  expandAllInline: jest.fn(),
  setAll: jest.fn(),
  toggle: jest.fn(),
  closePreview: jest.fn(),
  load: jest.fn(),
  openPreview: jest.fn(),
};

describe("LocalRemoteDiffSection truthfulness", () => {
  it("shows unknown remote-only count when local slice makes remote-only non-provable", () => {
    mockUseLocalRemoteDiffModel.mockReturnValue({
      ...baseModel,
      summary: {
        same: 0,
        modified: 2,
        localOnly: 1,
        remoteOnly: 8,
        skipped: 0,
        error: 0,
        total: 3,
        isPartial: true,
        countsAreLowerBounds: false,
        partialReason: "Vergleich ist teilweise: 60/120 lokale Dateien geprüft.",
        remoteOnlySemantics: "unknown" as const,
        dirtyLowerBound: 3,
      },
    });

    const { getByText, queryByText } = render(
      <LocalRemoteDiffSection activeRepo="owner/repo" activeBranch="main" projectFiles={[]} />,
    );

    expect(getByText(/⬇️ \?/)).toBeTruthy();
    expect(queryByText(/≥ ⬇️ 8/)).toBeNull();
    expect(getByText(/mindestens 3/)).toBeTruthy();
  });

  it("shows ≥ for remote-only only when it is a real lower bound", () => {
    mockUseLocalRemoteDiffModel.mockReturnValue({
      ...baseModel,
      summary: {
        same: 0,
        modified: 0,
        localOnly: 0,
        remoteOnly: 120,
        skipped: 0,
        error: 0,
        total: 120,
        isPartial: true,
        countsAreLowerBounds: true,
        partialReason: "Vergleich ist teilweise: Remote-only Liste wurde gekürzt.",
        remoteOnlySemantics: "lower_bound" as const,
        dirtyLowerBound: 120,
      },
    });

    const { getByText } = render(
      <LocalRemoteDiffSection activeRepo="owner/repo" activeBranch="main" projectFiles={[]} />,
    );

    expect(getByText(/≥ ⬇️ 120/)).toBeTruthy();
  });
});
