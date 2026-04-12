jest.mock("npm:fflate@0.8.2", () => ({
  unzipSync: jest.fn(() => ({})),
  strFromU8: jest.fn(() => ""),
}), { virtual: true });

import { classifyWorkflowLogsErrorStatus } from "../supabase/functions/github-workflow-logs/helpers";

describe("github-workflow-logs error truthfulness classifier", () => {
  it("maps client-side statuses to exact response statuses/codes", () => {
    expect(classifyWorkflowLogsErrorStatus(400)).toEqual({
      status: 400,
      error: "Invalid request",
      code: "invalid_request",
    });
    expect(classifyWorkflowLogsErrorStatus(401).code).toBe("unauthorized");
    expect(classifyWorkflowLogsErrorStatus(403).code).toBe("forbidden");
    expect(classifyWorkflowLogsErrorStatus(404).code).toBe("not_found");
    expect(classifyWorkflowLogsErrorStatus(413).status).toBe(413);
  });

  it("maps upstream 5xx to stable upstream_failure contract", () => {
    expect(classifyWorkflowLogsErrorStatus(500)).toEqual({
      status: 502,
      error: "GitHub upstream failure",
      code: "upstream_failure",
    });
    expect(classifyWorkflowLogsErrorStatus(503).status).toBe(502);
  });
});
