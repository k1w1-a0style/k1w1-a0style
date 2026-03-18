import {
  formatGitHubScopes,
  shouldRenderGitHubScopes,
} from "../screens/ConnectionsScreen/components/StatusCard";

describe("ConnectionsScreen GitHub scopes display", () => {
  it("treats a missing scopes header as optional and does not request a scopes row", () => {
    expect(formatGitHubScopes("")).toEqual({
      scopes: [],
      missing: [],
      unknown: true,
    });
    expect(shouldRenderGitHubScopes("")).toBe(false);
  });

  it("renders scopes when the header is available", () => {
    expect(formatGitHubScopes("workflow, repo")).toEqual({
      scopes: ["repo", "workflow"],
      missing: [],
      unknown: false,
    });
    expect(shouldRenderGitHubScopes("workflow, repo")).toBe(true);
  });
});
