import { fetchLatestRemoteDiagnosticsReport } from "../lib/diagnostics/remoteDiagnostics";

describe("remoteDiagnostics contract", () => {
  it("keeps diagnostics_reports direct reads disabled", async () => {
    await expect(
      fetchLatestRemoteDiagnosticsReport({ githubRepo: "owner/repo", branch: "main" }),
    ).rejects.toThrow(/disabled by contract/i);
  });
});
