import { filterReposForScreen } from "../screens/GitHubReposScreen/hooks/useGitHubReposDerivedState";

const repos = [
  { id: 1, name: "repo-a", full_name: "owner/repo-a", private: true, updated_at: "2026-01-01" },
  { id: 2, name: "repo-b", full_name: "owner/repo-b", private: false, updated_at: "2026-01-02" },
  { id: 3, name: "repo-c", full_name: "team/repo-c", private: true, updated_at: "2026-01-03" },
];

describe("useGitHubReposDerivedState", () => {
  it("filters activeOnly using activeRepo selection", () => {
    const filtered = filterReposForScreen({
      repos,
      activeRepo: "owner/repo-b",
      recentRepos: [],
      searchTerm: "",
      filterType: "activeOnly",
    });

    expect(filtered.map((r) => r.full_name)).toEqual(["owner/repo-b"]);
  });

  it("filters recentOnly and search term deterministically", () => {
    const filtered = filterReposForScreen({
      repos,
      activeRepo: null,
      recentRepos: ["owner/repo-a", "team/repo-c"],
      searchTerm: "team/",
      filterType: "recentOnly",
    });

    expect(filtered.map((r) => r.full_name)).toEqual(["team/repo-c"]);
  });
});
