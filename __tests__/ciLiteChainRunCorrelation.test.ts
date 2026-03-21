import {
  chooseWorkflowRunCandidate,
  matchesWorkflowRunContract,
} from "../components/CiLiteHeaderButton/hooks/workflowRunMatching";

describe("CI Lite chain-run correlation", () => {
  const startedAtMs = Date.parse("2026-03-21T10:00:00.000Z");
  const sourceHeadSha = "a".repeat(40);

  it("does not bind a chain-run by head_sha alone when the job_id marker is missing", () => {
    expect(
      matchesWorkflowRunContract(
        {
          id: 1,
          display_title: "CI Lite • main",
          event: "repository_dispatch",
          head_branch: "main",
          head_sha: sourceHeadSha,
          created_at: "2026-03-21T10:00:01.000Z",
        },
        {
          jobId: "job-123",
          branch: "main",
          startedAtMs,
          expectedEvent: "repository_dispatch",
          sourceHeadSha,
          requireJobIdMarker: true,
        },
      ),
    ).toBe(false);
  });

  it("prefers the run carrying the shared job_id marker when multiple fresh runs share the same head_sha", () => {
    const picked = chooseWorkflowRunCandidate(
      [
        {
          id: 101,
          display_title: "CI Lite • main",
          event: "repository_dispatch",
          head_branch: "main",
          head_sha: sourceHeadSha,
          created_at: "2026-03-21T10:00:02.000Z",
        },
        {
          id: 202,
          display_title: "CI Lite [job-123] • main",
          event: "repository_dispatch",
          head_branch: "main",
          head_sha: sourceHeadSha,
          created_at: "2026-03-21T10:00:03.000Z",
        },
      ],
      {
        jobId: "job-123",
        branch: "main",
        startedAtMs,
        expectedEvent: "repository_dispatch",
        sourceHeadSha,
        requireJobIdMarker: true,
      },
    );

    expect(picked).toMatchObject({ id: 202 });
  });

  it("keeps manual workflow_dispatch matching on the explicit job_id marker", () => {
    const picked = chooseWorkflowRunCandidate(
      [
        {
          id: 301,
          display_title: "CI Lite [job-other] • main",
          event: "workflow_dispatch",
          head_branch: "main",
          created_at: "2026-03-21T10:00:02.000Z",
        },
        {
          id: 302,
          display_title: "CI Lite (job_id=job-123) • main",
          event: "workflow_dispatch",
          head_branch: "main",
          created_at: "2026-03-21T10:00:03.000Z",
        },
      ],
      {
        jobId: "job-123",
        branch: "main",
        startedAtMs,
        expectedEvent: "workflow_dispatch",
        requireJobIdMarker: true,
      },
    );

    expect(picked).toMatchObject({ id: 302 });
  });
});
