import type { ProjectData } from "../shared/types/project";
import {
  resolveBuildProfileForStart,
  resolveHistoryBuildSelection,
  resolveLinkedBranchForRepoSelection,
} from "../contexts/ProjectContext";
import {
  prepareBuildStart,
  resolveBuildSelectionAfterStart,
} from "../contexts/projectContextBuildHelpers";

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


describe("projectContextBuildHelpers prepareBuildStart", () => {
  const baseProject: ProjectData = {
    id: "p1",
    name: "Demo",
    slug: "demo",
    files: [{ path: "App.tsx", content: "export default null" }],
    linkedRepo: "owner/repo",
    linkedBranch: "main",
    preferredBuildProfile: "production",
    chatHistory: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    lastModified: "2026-01-01T00:00:00.000Z",
  };

  it("derives repo/branch/profile/selection snapshot in one place", () => {
    const prepared = prepareBuildStart({
      projectData: baseProject,
      requestedProfile: undefined,
      nowIso: "2026-04-05T00:00:00.000Z",
    });

    expect(prepared.githubRepo).toBe("owner/repo");
    expect(prepared.branch).toBe("main");
    expect(prepared.profile).toBe("production");
    expect(prepared.selection).toEqual({
      jobId: null,
      repoName: "owner/repo",
      branch: "main",
      buildProfile: "production",
    });
  });

  it("throws fail-closed when project has no files or no linked repo", () => {
    expect(() =>
      prepareBuildStart({
        projectData: { ...baseProject, files: [] },
      }),
    ).toThrow(/Projekt ist leer/i);

    expect(() =>
      prepareBuildStart({
        projectData: { ...baseProject, linkedRepo: " " },
      }),
    ).toThrow(/Kein GitHub-Repo verknüpft/i);
  });

  it("maps resolved build start selection after job creation", () => {
    expect(
      resolveBuildSelectionAfterStart({
        jobId: "job-1",
        githubRepo: "owner/repo",
        branch: "release/1",
        buildProfile: "preview",
      }),
    ).toEqual({
      jobId: "job-1",
      repoName: "owner/repo",
      branch: "release/1",
      buildProfile: "preview",
    });
  });
});
