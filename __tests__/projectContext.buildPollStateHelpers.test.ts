import {
  createBuildHistoryStatusSnapshot,
  getValidContextMessages,
  getBuildStatusMessage,
  mergeBuildPollIntoCurrentBuild,
  resolveBuildHistoryPollUpdate,
  shouldUpdateBuildHistoryStatus,
} from "../contexts/projectContextStateHelpers";
import {
  createBuildErrorState,
  createBuildPollingAbortState,
  createBuildQueuedStateAfterStart,
  createBuildQueuedStateForStart,
  resolveBuildStartErrorMessage,
  resolveBuildStartContext,
  shouldSyncCurrentBuildFromPoll,
  shouldUpdateHistoryFromPoll,
} from "../contexts/projectContextBuildHelpers";

describe("projectContextStateHelpers build poll state mapping", () => {
  it("keeps existing urls when poll details omit them", () => {
    const merged = mergeBuildPollIntoCurrentBuild({
      previous: {
        status: "queued",
        urls: {
          html: "https://example.com/old-html",
          artifacts: "https://example.com/old-artifacts",
          buildUrl: null,
        },
      },
      activeJobId: "job-1",
      details: {
        jobId: "job-1",
        status: "building",
        runId: 1,
        sourceCommitSha: "abc123",
        raw: null,
      },
      status: "building",
      lastError: null,
      nowIso: "2026-04-05T00:00:00.000Z",
    });

    expect(merged.urls).toEqual({
      html: "https://example.com/old-html",
      artifacts: "https://example.com/old-artifacts",
      buildUrl: null,
    });
    expect(merged.runId).toBe(1);
    expect(merged.sourceCommitSha).toBe("abc123");
  });

  it("sets completedAt only for final/error states", () => {
    const successState = mergeBuildPollIntoCurrentBuild({
      previous: { status: "building" },
      activeJobId: "job-1",
      details: null,
      status: "success",
      nowIso: "2026-04-05T00:00:01.000Z",
    });
    expect(successState.completedAt).toBe("2026-04-05T00:00:01.000Z");

    const buildingState = mergeBuildPollIntoCurrentBuild({
      previous: { status: "building", completedAt: "2026-04-05T00:00:01.000Z" },
      activeJobId: "job-1",
      details: null,
      status: "building",
      nowIso: "2026-04-05T00:00:02.000Z",
    });
    expect(buildingState.completedAt).toBe("2026-04-05T00:00:01.000Z");
  });

  it("builds status messages for polling states", () => {
    expect(getBuildStatusMessage({ status: "queued" })).toContain("Warteschlange");
    expect(getBuildStatusMessage({ status: "building" })).toContain("Build läuft");
    expect(getBuildStatusMessage({ status: "error", lastError: "Timeout" })).toContain("Timeout");
  });

  it("updates history status only when job or status changed", () => {
    expect(
      shouldUpdateBuildHistoryStatus({
        lastSnapshot: null,
        activeJobId: "job-1",
        status: "queued",
      }),
    ).toBe(true);

    const snapshot = createBuildHistoryStatusSnapshot({
      activeJobId: "job-1",
      status: "queued",
    });

    expect(
      shouldUpdateBuildHistoryStatus({
        lastSnapshot: snapshot,
        activeJobId: "job-1",
        status: "queued",
      }),
    ).toBe(false);

    expect(
      shouldUpdateBuildHistoryStatus({
        lastSnapshot: snapshot,
        activeJobId: "job-1",
        status: "building",
      }),
    ).toBe(true);
  });

  it("resolves poll-driven history updates only when details and status delta exist", () => {
    expect(
      resolveBuildHistoryPollUpdate({
        activeJobId: null,
        details: null,
        status: "queued",
        lastSnapshot: null,
      }),
    ).toBeNull();

    const next = resolveBuildHistoryPollUpdate({
      activeJobId: "job-1",
      details: {
        jobId: "job-1",
        status: "building",
        runId: 11,
        sourceCommitSha: "abc123",
        urls: {
          html: "https://example.com/run",
          artifacts: "https://example.com/artifacts",
        },
        raw: null,
      },
      status: "building",
      lastSnapshot: createBuildHistoryStatusSnapshot({
        activeJobId: "job-1",
        status: "queued",
      }),
      selectionSnapshot: {
        jobId: "job-1",
        repoName: "owner/repo",
        branch: "main",
        buildProfile: "preview",
      },
      currentBuild: {
        githubRepo: "fallback/repo",
        branch: "release",
        buildProfile: "production",
      },
    });

    expect(next).toEqual({
      nextSnapshot: {
        jobId: "job-1",
        status: "building",
      },
      update: {
        jobId: "job-1",
        status: "building",
        repoName: "owner/repo",
        branch: "main",
        buildProfile: "preview",
        htmlUrl: "https://example.com/run",
        artifactUrl: "https://example.com/artifacts",
        sourceCommitSha: "abc123",
      },
    });

    expect(
      resolveBuildHistoryPollUpdate({
        activeJobId: "job-1",
        details: {
          jobId: "job-1",
          status: "building",
          runId: 11,
          raw: null,
        },
        status: "building",
        lastSnapshot: createBuildHistoryStatusSnapshot({
          activeJobId: "job-1",
          status: "building",
        }),
      }),
    ).toBeNull();
  });

  it("filters invalid chat messages for context value stability", () => {
    const messages = getValidContextMessages([
      { id: "m1", role: "user", content: "ok", timestamp: "t1" },
      { id: "", role: "assistant", content: "missing id but has ts", timestamp: "t2" },
      { id: "m3", role: "assistant", content: 123 as unknown as string, timestamp: "t3" },
      null as unknown as { id: string; role: "assistant"; content: string; timestamp: string },
    ]);

    expect(messages).toHaveLength(2);
    expect(messages[0]?.id).toBe("m1");
    expect(messages[1]?.timestamp).toBe("t2");
  });
});


describe("projectContextBuildHelpers orchestration guards", () => {
  it("creates queued build states before and after successful start", () => {
    const beforeStart = createBuildQueuedStateForStart({
      githubRepo: "owner/repo",
      branch: "main",
      buildProfile: "preview",
      startedAt: "2026-04-05T00:00:00.000Z",
    });

    expect(beforeStart).toMatchObject({
      status: "queued",
      jobId: null,
      githubRepo: "owner/repo",
      branch: "main",
      buildProfile: "preview",
      startedAt: "2026-04-05T00:00:00.000Z",
    });

    const afterStart = createBuildQueuedStateAfterStart({
      previous: beforeStart,
      jobId: "job-1",
      githubRepo: "owner/repo",
      branch: "release/1",
      buildProfile: "production",
      nowIso: "2026-04-05T00:00:02.000Z",
    });

    expect(afterStart).toMatchObject({
      status: "queued",
      message: "✅ Build gestartet. Warte auf GitHub Actions…",
      jobId: "job-1",
      branch: "release/1",
      buildProfile: "production",
      lastUpdatedAt: "2026-04-05T00:00:02.000Z",
    });
  });

  it("creates poll abort and generic error states", () => {
    const pollAbort = createBuildPollingAbortState({
      previous: { status: "building", jobId: "job-1" },
      lastError: "Timeout",
      nowIso: "2026-04-05T00:00:03.000Z",
    });

    expect(pollAbort.status).toBe("error");
    expect(pollAbort.message).toContain("Timeout");
    expect(pollAbort.lastUpdatedAt).toBe("2026-04-05T00:00:03.000Z");

    const genericError = createBuildErrorState({
      message: "boom",
      nowIso: "2026-04-05T00:00:04.000Z",
    });
    expect(genericError).toEqual({
      status: "error",
      message: "boom",
      lastUpdatedAt: "2026-04-05T00:00:04.000Z",
    });
  });

  it("maps unknown build start errors to stable user-facing text", () => {
    expect(resolveBuildStartErrorMessage(new Error("dispatch failed"))).toBe("dispatch failed");
    expect(resolveBuildStartErrorMessage("network down")).toBe("network down");
    expect(resolveBuildStartErrorMessage({ detail: "opaque" })).toBe("Build konnte nicht gestartet werden.");
  });

  it("guards poll sync/history updates with explicit predicates", () => {
    expect(shouldSyncCurrentBuildFromPoll({ activeJobId: null })).toBe(false);
    expect(shouldSyncCurrentBuildFromPoll({ activeJobId: "job-1" })).toBe(true);

    expect(
      shouldUpdateHistoryFromPoll({
        activeJobId: "job-1",
        details: null,
        status: "queued",
      }),
    ).toBe(false);
    expect(
      shouldUpdateHistoryFromPoll({
        activeJobId: "job-1",
        details: {
          jobId: "job-1",
          status: "building",
          runId: 11,
          sourceCommitSha: null,
          raw: null,
        },
        status: "building",
      }),
    ).toBe(true);
  });

  it("resolves build start context with explicit repo/profile SoT", () => {
    const context = resolveBuildStartContext({
      project: {
        id: "p1",
        name: "Project",
        files: [{ path: "App.tsx", content: "export default 1;" }],
        chatHistory: [],
        createdAt: "2026-04-06T00:00:00.000Z",
        linkedRepo: " owner/repo ",
        linkedBranch: " release ",
        preferredBuildProfile: "production",
        lastModified: "2026-04-06T00:00:00.000Z",
      },
      requestedBuildProfile: "preview",
    });

    expect(context.githubRepo).toBe("owner/repo");
    expect(context.branch).toBe("release");
    expect(context.buildProfile).toBe("preview");
  });

  it("fails closed when build start context has no files or no linked repo", () => {
    expect(() =>
      resolveBuildStartContext({
        project: {
          id: "p2",
          name: "Empty",
          files: [],
          chatHistory: [],
          createdAt: "2026-04-06T00:00:00.000Z",
          linkedRepo: "owner/repo",
          linkedBranch: "main",
          lastModified: "2026-04-06T00:00:00.000Z",
        },
      }),
    ).toThrow("Projekt ist leer");

    expect(() =>
      resolveBuildStartContext({
        project: {
          id: "p3",
          name: "NoRepo",
          files: [{ path: "App.tsx", content: "ok" }],
          chatHistory: [],
          createdAt: "2026-04-06T00:00:00.000Z",
          linkedRepo: " ",
          linkedBranch: "main",
          lastModified: "2026-04-06T00:00:00.000Z",
        },
      }),
    ).toThrow("Kein GitHub-Repo verknüpft");
  });
});
