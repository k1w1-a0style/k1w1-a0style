import { mergeRecentRepo, normalizeLinkedGitHubValue } from "../contexts/githubContextHelpers";

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
