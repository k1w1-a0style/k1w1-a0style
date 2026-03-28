import { mergeRecentRepo, normalizeLinkedGitHubValue, normalizeStoredRecentRepos } from "../contexts/githubContextHelpers";

describe("githubContextHelpers", () => {
  describe("mergeRecentRepo", () => {
    it("moves the selected repo to the front and removes duplicates", () => {
      expect(mergeRecentRepo(["a/x", "b/y", "a/x"], "b/y")).toEqual(["b/y", "a/x", "a/x"]);
    });

    it("keeps list length capped at 10", () => {
      const repos = Array.from({ length: 10 }, (_, index) => `owner/repo-${index}`);
      const result = mergeRecentRepo(repos, "owner/new-repo");

      expect(result).toHaveLength(10);
      expect(result[0]).toBe("owner/new-repo");
      expect(result).not.toContain("owner/repo-9");
    });

    it("returns a copy unchanged when repo input is empty", () => {
      const previous = ["owner/repo"];
      const result = mergeRecentRepo(previous, "");

      expect(result).toEqual(previous);
      expect(result).not.toBe(previous);
    });
  });


  describe("normalizeStoredRecentRepos", () => {
    it("keeps only trimmed string entries, removes duplicates, and caps to 10", () => {
      const parsed = [
        " owner/repo-1 ",
        "",
        "owner/repo-2",
        "owner/repo-1",
        null,
        123,
        "   ",
        ...Array.from({ length: 20 }, (_, index) => `owner/repo-${index + 3}`),
      ];

      const normalized = normalizeStoredRecentRepos(parsed);

      expect(normalized).toEqual([
        "owner/repo-1",
        "owner/repo-2",
        "owner/repo-3",
        "owner/repo-4",
        "owner/repo-5",
        "owner/repo-6",
        "owner/repo-7",
        "owner/repo-8",
        "owner/repo-9",
        "owner/repo-10",
      ]);
    });

    it("returns an empty list for non-array payloads", () => {
      expect(normalizeStoredRecentRepos(null)).toEqual([]);
      expect(normalizeStoredRecentRepos("owner/repo")).toEqual([]);
      expect(normalizeStoredRecentRepos({ value: ["owner/repo"] })).toEqual([]);
    });
  });

  describe("normalizeLinkedGitHubValue", () => {
    it("trims valid values", () => {
      expect(normalizeLinkedGitHubValue("  owner/repo  ")).toBe("owner/repo");
    });

    it("falls back to null for undefined, null, or whitespace", () => {
      expect(normalizeLinkedGitHubValue(undefined)).toBeNull();
      expect(normalizeLinkedGitHubValue(null)).toBeNull();
      expect(normalizeLinkedGitHubValue("   ")).toBeNull();
    });
  });
});
