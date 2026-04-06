import {
  resolveBuildProfileForStart,
  resolveHistoryBuildSelection,
  resolveLinkedBranchForRepoSelection,
  resolveTemplateMode,
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

  describe("resolveTemplateMode", () => {
    it("falls back to auto for empty template ids", () => {
      expect(resolveTemplateMode(undefined)).toBe("auto");
      expect(resolveTemplateMode(null)).toBe("auto");
      expect(resolveTemplateMode("   ")).toBe("auto");
    });

    it("returns trimmed template id when present", () => {
      expect(resolveTemplateMode(" blank ")).toBe("blank");
    });
  });
});


describe("resolveHistoryBuildSelection", () => {
  it("prefers the start snapshot when it belongs to the active job", () => {
    expect(
      resolveHistoryBuildSelection({
        activeJobId: "123",
        snapshot: {
          jobId: "123",
          repoName: "owner/repo-from-start",
          branch: "release/1",
          buildProfile: "production",
        },
        currentBuild: {
          githubRepo: "owner/repo-from-poll",
          branch: "main",
          buildProfile: "preview",
        },
      }),
    ).toEqual({
      repoName: "owner/repo-from-start",
      branch: "release/1",
      buildProfile: "production",
    });
  });

  it("falls back to current build values for unrelated jobs", () => {
    expect(
      resolveHistoryBuildSelection({
        activeJobId: "123",
        snapshot: {
          jobId: "999",
          repoName: "owner/repo-from-start",
          branch: "release/1",
          buildProfile: "production",
        },
        currentBuild: {
          githubRepo: "owner/repo-from-poll",
          branch: "main",
          buildProfile: "preview",
        },
      }),
    ).toEqual({
      repoName: "owner/repo-from-poll",
      branch: "main",
      buildProfile: "preview",
    });
  });
});
