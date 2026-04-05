import { buildGitHubAuthHeaders } from "../hooks/useGitHubRepos";

describe("useGitHubRepos header helpers", () => {
  it("builds stable github auth headers", () => {
    expect(buildGitHubAuthHeaders("abc123")).toEqual({
      Accept: "application/vnd.github+json",
      Authorization: "token abc123",
    });
  });
});
