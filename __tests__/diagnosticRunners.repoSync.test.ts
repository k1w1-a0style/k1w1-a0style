import type { PreflightCheckResult } from "../lib/diagnostics/preflightTypes";

jest.mock("../lib/diagnostics/buildPipelineDiagnostics", () => ({
  runBuildPipelineDiagnostics: jest.fn(async () => ({
    checks: [
      { id: "pipeline.ok", title: "ok", status: "pass", details: "ok" },
    ],
  })),
}));

const mockGetItem = jest.fn();
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (...args: any[]) => mockGetItem(...args),
}));

import { runPipelineChecks } from "../screens/DiagnosticScreen/hooks/diagnosticRunners";
import { computeProjectFilesSignature } from "../lib/repoSyncOrchestration";

describe("runPipelineChecks repo sync guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("blocks pipeline checks when local state drifted from tracked repo signature", async () => {
    const files = [{ path: "app.json", content: "{}" }] as any;
    const staleSig = computeProjectFilesSignature([{ path: "app.json", content: "{\"x\":1}" }] as any);
    const key = `repo_sync_signature::${encodeURIComponent("owner/repo")}::${encodeURIComponent("main")}`;
    mockGetItem.mockImplementation(async (k: string) => (k === key ? staleSig : null));

    const all: PreflightCheckResult[] = [];
    await runPipelineChecks({
      includePipelineChecks: true,
      linkedRepo: "owner/repo",
      linkedBranch: "main",
      files,
      pipelineAppliesToFocus: () => true,
      all,
      mountedRef: { current: true } as any,
      setResults: () => {},
      setProgressStage: () => {},
    });

    expect(all.some((r) => r.id === "pipeline::repoSyncRequired")).toBe(true);
  });
});
