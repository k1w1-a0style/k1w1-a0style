import { getArtifactUiMessage, sanitizeArtifactDetail } from "../components/CiLiteHeaderButton/hooks/ciLiteWorkflowNoticeHelpers";

describe("ciLiteWorkflowNoticeHelpers", () => {
  it("returns empty detail for empty artifact error", () => {
    expect(getArtifactUiMessage({ artifactError: null })).toBe("");
    expect(getArtifactUiMessage({ artifactError: "" })).toBe("");
  });

  it("keeps successful-run artifact message contract with detail suffix", () => {
    const message = getArtifactUiMessage({
      artifactError: "artifact endpoint timeout",
      workflowStatus: "completed",
      workflowConclusion: "success",
    });

    expect(message).toContain("Workflow war erfolgreich");
    expect(message).toContain("Detail: artifact endpoint timeout");
  });

  it("uses generic artifact notice when run was not successful", () => {
    const message = getArtifactUiMessage({
      artifactError: "artifact endpoint timeout",
      workflowStatus: "in_progress",
      workflowConclusion: null,
    });

    expect(message).toContain("Zusätzliche Ergebnisdaten zum Run konnten nicht geladen werden.");
    expect(message).toContain("Detail: artifact endpoint timeout");
  });

  it("redacts token/admin-key/bearer secrets and truncates long detail", () => {
    const input = [
      "github_pat_11ABCdefGHijkLMNopQRsTuvWXyz_1234567890",
      "ghp_superSecretTokenValue",
      "x-k1w1-admin-key: adminSecret",
      "authorization: bearer verySecret",
      "x".repeat(400),
    ].join(" ");

    const sanitized = sanitizeArtifactDetail(input);
    expect(sanitized).toContain("[redacted-token]");
    expect(sanitized).toContain("x-k1w1-admin-key: [redacted]");
    expect(sanitized).toContain("authorization: bearer [redacted]");
    expect(sanitized).not.toContain("adminSecret");
    expect(sanitized).not.toContain("ghp_superSecretTokenValue");
    expect(sanitized.length).toBeLessThanOrEqual(181);
  });
});
