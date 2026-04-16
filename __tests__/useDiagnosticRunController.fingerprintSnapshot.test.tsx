import { act, renderHook } from "@testing-library/react-native";

import { computeDiagnosticProjectFingerprint } from "../lib/diagnosticReadinessRecord";
import { makeProjectData, makeProjectFile } from "./helpers/projectTestHelpers";
import { useDiagnosticRunController } from "../screens/DiagnosticScreen/hooks/useDiagnosticRunController";

const mockMultiSet = jest.fn(async (_entries: ReadonlyArray<readonly [string, string]>) => undefined);
const mockMultiRemove = jest.fn(async (_keys: ReadonlyArray<string>) => undefined);

jest.mock("@react-native-async-storage/async-storage", () => ({
  multiSet: mockMultiSet,
  multiRemove: mockMultiRemove,
}));

const mockRunLocalChecks = jest.fn();
const mockRunPipelineChecks = jest.fn();

jest.mock("../screens/DiagnosticScreen/hooks/diagnosticRunners", () => ({
  runLocalChecks: (...args: unknown[]) => mockRunLocalChecks(...args),
  runPipelineChecks: (...args: unknown[]) => mockRunPipelineChecks(...args),
}));

describe("useDiagnosticRunController fingerprint snapshot contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunPipelineChecks.mockImplementation(async () => undefined);
  });

  it("persists green readiness with the run-start file fingerprint even when projectRef files mutate mid-run", async () => {
    const runSnapshotFiles = [
      makeProjectFile("App.tsx", "export default function App(){return null;}"),
      makeProjectFile("package.json", "{\"name\":\"snapshot\"}"),
    ];
    const liveMutatedFiles = [
      makeProjectFile("App.tsx", "export default function App(){return 'mutated';}"),
      makeProjectFile("package.json", "{\"name\":\"live-mutated\"}"),
      makeProjectFile("new.ts", "export const x = 1;"),
    ];
    const expectedRunFingerprint = computeDiagnosticProjectFingerprint(runSnapshotFiles);
    const unexpectedLiveFingerprint = computeDiagnosticProjectFingerprint(liveMutatedFiles);
    expect(expectedRunFingerprint).not.toBe(unexpectedLiveFingerprint);

    const projectRef = {
      current: makeProjectData({
        files: runSnapshotFiles,
        linkedRepo: "owner/repo",
        linkedBranch: "main",
      }),
    };
    const mountedRef = { current: true };
    const clearHistoryRef = { current: jest.fn() };

    mockRunLocalChecks.mockImplementation(async ({ all }: { all: Array<{ status: string }> }) => {
      all.push({ status: "pass" } as never);
      projectRef.current = {
        ...projectRef.current,
        files: liveMutatedFiles,
      };
    });

    const { result } = renderHook(() =>
      useDiagnosticRunController({
        projectRef,
        mountedRef,
        linkedRepo: "owner/repo",
        linkedBranch: "main",
        includeLocalChecks: true,
        includePipelineChecks: true,
        modesAll: false,
        selectedModes: [],
        recommendedMode: "preview",
        pipelineAppliesToFocus: () => true,
        clearSelection: jest.fn(),
        clearHistoryRef,
        onScopeInvalidated: jest.fn(),
      }),
    );

    await act(async () => {
      await result.current.runDiagnostics();
    });

    expect(mockMultiSet).toHaveBeenCalled();
    const lastCall = mockMultiSet.mock.calls[mockMultiSet.mock.calls.length - 1];
    const lastMultiSetPayload = (lastCall?.[0] ?? []) as Array<[string, string]>;
    const recordEntry = lastMultiSetPayload.find(([key]) => key.startsWith("diagnostic_readiness_record::"));
    expect(recordEntry).toBeTruthy();
    const parsed = JSON.parse(String(recordEntry?.[1])) as {
      diagnosticOk: boolean;
      projectFingerprint: string;
    };

    expect(parsed.diagnosticOk).toBe(true);
    expect(parsed.projectFingerprint).toBe(expectedRunFingerprint);
    expect(parsed.projectFingerprint).not.toBe(unexpectedLiveFingerprint);
  });
});
