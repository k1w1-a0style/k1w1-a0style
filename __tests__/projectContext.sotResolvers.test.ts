import {
  resolveBuildProfileForStart,
  resolveLinkedBranchForRepoSelection,
} from "../contexts/ProjectContext";

describe("ProjectContext SoT resolvers", () => {
  describe("resolveLinkedBranchForRepoSelection", () => {
    it("keeps previous branch when repo stays the same and no branch update is provided", () => {
      expect(
        resolveLinkedBranchForRepoSelection({
          previousRepo: "owner/repo",
          nextRepo: "owner/repo",
          previousBranch: "feature/a",
        }),
      ).toBe("feature/a");
    });

    it("clears stale branch when repo changes without explicit branch selection", () => {
      expect(
        resolveLinkedBranchForRepoSelection({
          previousRepo: "owner/repo-a",
          nextRepo: "owner/repo-b",
          previousBranch: "feature/a",
        }),
      ).toBeNull();
    });

    it("always respects explicit branch updates including null", () => {
      expect(
        resolveLinkedBranchForRepoSelection({
          previousRepo: "owner/repo-a",
          nextRepo: "owner/repo-b",
          previousBranch: "feature/a",
          nextBranch: "main",
        }),
      ).toBe("main");

      expect(
        resolveLinkedBranchForRepoSelection({
          previousRepo: "owner/repo-a",
          nextRepo: "owner/repo-b",
          previousBranch: "feature/a",
          nextBranch: null,
        }),
      ).toBeNull();
    });
  });

  describe("resolveBuildProfileForStart", () => {
    it("prefers explicit requested profile", () => {
      expect(
        resolveBuildProfileForStart({
          requestedProfile: "production",
          preferredProfile: "preview",
        }),
      ).toBe("production");
    });

    it("falls back to persisted preferred profile when request is missing/invalid", () => {
      expect(
        resolveBuildProfileForStart({
          requestedProfile: undefined,
          preferredProfile: "development",
        }),
      ).toBe("development");

      expect(
        resolveBuildProfileForStart({
          requestedProfile: "prod",
          preferredProfile: "preview",
        }),
      ).toBe("preview");
    });

    it("uses preview only as last resort", () => {
      expect(
        resolveBuildProfileForStart({
          requestedProfile: undefined,
          preferredProfile: null,
        }),
      ).toBe("preview");
    });
  });
});
