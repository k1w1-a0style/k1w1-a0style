jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
}));

import React from "react";
import { Text, TouchableOpacity, Alert } from "react-native";
import { act, render, fireEvent, waitFor, cleanup, type RenderAPI } from "@testing-library/react-native";

import type { BuildProfile } from "../screens/EnhancedBuildScreen/types";
import type { DeployStep, DeployStepId } from "../screens/EnhancedBuildScreen/hooks/useOneClickDeploy";
import { computeProjectFilesSignature } from "../lib/repoSyncOrchestration";

const mockAsyncStorageGetItem = jest.fn();
const mockAsyncStorageSetItem = jest.fn();
const mockAsyncStorageRemoveItem = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: mockAsyncStorageGetItem,
    setItem: mockAsyncStorageSetItem,
    removeItem: mockAsyncStorageRemoveItem,
  },
  getItem: mockAsyncStorageGetItem,
  setItem: mockAsyncStorageSetItem,
  removeItem: mockAsyncStorageRemoveItem,
}));

// IMPORTANT:
// useOneClickDeploy imports deep-relative module ids like "../../../infra/github/githubService".
// If we mock with a *different* string, Jest won't apply the mock.
// Solution: mock by the resolved absolute file path (require.resolve), then require the hook AFTER mocks.

const mockGitHub = {
  getGitHubToken: jest.fn(),
  getExpoToken: jest.fn(),
  getWorkflowAdminKey: jest.fn(),
  getAndroidKeystoreExportAdminKey: jest.fn(),
  getBranchHeadSha: jest.fn(),
};

const mockSecrets = {
  autoSyncRepoSecrets: jest.fn(),
};

const mockProjectData = { files: [] as { path: string; content: string }[] };

const mockProject = {
  useProject: () => ({
    projectData: mockProjectData,
  }),
};
const mockReadSigningKeyGateState = jest.fn();
const mockEvaluateBuildReadiness = jest.fn();
const mockGetRepoSyncState = jest.fn();
const mockReadLocalBuildGateState = jest.fn();

// Mock modules by absolute path so it matches regardless of the importer relative string.
const ghServicePath = require.resolve("../infra/github/githubService");
const secretsPath = require.resolve("../lib/autoSyncRepoSecrets");
const projectCtxPath = require.resolve("../contexts/ProjectContext");
const signingGatePath = require.resolve("../screens/EnhancedBuildScreen/hooks/signingKeyGate");
const buildReadinessPath = require.resolve("../lib/buildReadiness");
const repoSyncPath = require.resolve("../lib/repoSyncOrchestration");
const buildPreconditionsPath = require.resolve("../screens/EnhancedBuildScreen/hooks/useBuildPreconditions");

jest.doMock(ghServicePath, () => mockGitHub);
jest.doMock(secretsPath, () => mockSecrets);
jest.doMock(projectCtxPath, () => mockProject);
jest.doMock(signingGatePath, () => ({
  readSigningKeyGateState: mockReadSigningKeyGateState,
}));
jest.doMock(buildReadinessPath, () => ({
  evaluateBuildReadiness: mockEvaluateBuildReadiness,
}));
jest.doMock(repoSyncPath, () => ({
  getRepoSyncState: mockGetRepoSyncState,
}));
jest.doMock(buildPreconditionsPath, () => ({
  readLocalBuildGateState: mockReadLocalBuildGateState,
}));

// Require AFTER mocks
type OneClickDeployModule = typeof import("../screens/EnhancedBuildScreen/hooks/useOneClickDeploy");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useOneClickDeploy }: OneClickDeployModule = require("../screens/EnhancedBuildScreen/hooks/useOneClickDeploy");

function Harness(props: {
  profile: BuildProfile;
  repo: string;
  branch: string;
  startBuild?: (profile: BuildProfile) => Promise<void>;
}) {
  const hook = useOneClickDeploy(
    props.profile,
    props.repo,
    props.branch,
    props.startBuild,
  );

  return (
    <>
      {/*
        IMPORTANT:
        Do NOT return the Promise from the press handler.
        React Test Renderer / act may await it and a mocked AsyncStorage can stall -> test timeout.
      */}
      <TouchableOpacity testID="run" onPress={() => void hook.runDeploy()}>
        <Text>run</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="abort" onPress={hook.abort}>
        <Text>abort</Text>
      </TouchableOpacity>
      <Text testID="steps">{JSON.stringify(hook.steps)}</Text>
      <Text testID="done">{hook.deployDone ? "true" : "false"}</Text>
      <Text testID="deploying">{hook.isDeploying ? "true" : "false"}</Text>
    </>
  );
}

function getSteps(getByTestId: RenderAPI["getByTestId"]): DeployStep[] {
  const raw = String(getByTestId("steps").props.children ?? "[]");
  return JSON.parse(raw) as DeployStep[];
}

function findStep(steps: DeployStep[], id: DeployStepId): DeployStep {
  const step = steps.find((s) => s.id === id);
  if (!step) throw new Error(`Missing deploy step: ${id}`);
  return step;
}

async function pressRun(getByTestId: RenderAPI["getByTestId"]) {
  await act(async () => {
    fireEvent.press(getByTestId("run"));
    await Promise.resolve();
  });
}

describe("useOneClickDeploy", () => {
  let alertSpy: jest.SpiedFunction<typeof Alert.alert>;
  beforeAll(() => {
    jest.useRealTimers();
    jest.setTimeout(20000);
  });
  beforeEach(() => {
    jest.useRealTimers();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    mockGitHub.getGitHubToken.mockReset();
    mockGitHub.getExpoToken.mockReset();
    mockGitHub.getWorkflowAdminKey.mockReset();
    mockGitHub.getBranchHeadSha.mockReset();
    mockGitHub.getAndroidKeystoreExportAdminKey.mockReset();
    mockSecrets.autoSyncRepoSecrets.mockReset();
    // Reset AsyncStorage mocks per test
    mockAsyncStorageGetItem.mockReset();
    mockAsyncStorageSetItem.mockReset();
    mockAsyncStorageRemoveItem.mockReset();
    mockAsyncStorageGetItem.mockResolvedValue(null);
    mockAsyncStorageSetItem.mockResolvedValue(undefined);
    mockAsyncStorageRemoveItem.mockResolvedValue(undefined);
    mockGitHub.getBranchHeadSha.mockResolvedValue("a".repeat(40));
    mockGitHub.getWorkflowAdminKey.mockResolvedValue("workflow-admin-key");
    mockGitHub.getAndroidKeystoreExportAdminKey.mockResolvedValue("keystore-admin-key-12345678901234567890");
    mockProjectData.files = [];
    mockReadSigningKeyGateState.mockReset();
    mockReadSigningKeyGateState.mockResolvedValue({
      hasSigningKey: true,
      reason: null,
      localEdgeAdminKeyPresent: true,
      credentialState: "verified",
      credentialDetail: null,
    });
    mockEvaluateBuildReadiness.mockReset();
    mockEvaluateBuildReadiness.mockResolvedValue({
      ok: true,
      reasonCode: null,
      message: null,
      snapshot: null,
      context: {
        linkedRepo: "owner/repo",
        linkedBranch: "main",
        diagnosticOk: true,
      },
    });
    mockGetRepoSyncState.mockReset();
    mockGetRepoSyncState.mockResolvedValue("in_sync");
    mockReadLocalBuildGateState.mockReset();
    mockReadLocalBuildGateState.mockResolvedValue({
      hasTokens: true,
      tokenReason: null,
      hasWorkflowAdminKey: true,
      workflowAdminKeyReason: null,
      hasOperatorJwt: true,
      operatorJwtReason: null,
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
    jest.clearAllTimers();
    cleanup();
  });

  it("fails hard when signing key is missing (no skip)", async () => {
    mockReadSigningKeyGateState.mockResolvedValueOnce({
      hasSigningKey: false,
      reason: "Lokaler Android Keystore Export Admin Key fehlt",
      localEdgeAdminKeyPresent: false,
      credentialState: "missing",
      credentialDetail: null,
    });

    // Signing key is missing => should fail BEFORE token step.
    mockAsyncStorageGetItem.mockImplementation(async (k: string) => {
      if (k === "cred_key_exists_preview") return null;
      return null;
    });

    mockGitHub.getAndroidKeystoreExportAdminKey.mockResolvedValue(null);

    const startBuild = jest.fn(async () => {});
    const { getByTestId } = render(
      <Harness
        profile="preview"
        repo="owner/repo"
        branch="main"
        startBuild={startBuild}
      />,
    );

    await pressRun(getByTestId);

    await waitFor(
      () => {
        const steps = getSteps(getByTestId);
        const signing = findStep(steps, "signing_key");
        expect(signing.status).toBe("fail");
        expect(signing.detail).toMatch(/lokaler android keystore export admin key wurde vom edge-server abgelehnt|lokaler android keystore export admin key fehlt/i);
      },
      { timeout: 12000 },
    );

    const steps = getSteps(getByTestId);
    const tokens = findStep(steps, "tokens");
    const build = findStep(steps, "build");

    expect(tokens.status).toBe("pending");
    expect(build.status).toBe("pending");
    expect(startBuild).not.toHaveBeenCalled();
  }, 30000);

  it("stale aborted run finalizer must not clobber a newer run", async () => {
    mockGitHub.getGitHubToken.mockResolvedValue("gh");
    mockGitHub.getExpoToken.mockResolvedValue("expo");
    mockProjectData.files = [{ path: "App.tsx", content: "export default function App(){return null;}" }];

    const firstBuild = (() => {
      let resolve!: () => void;
      const promise = new Promise<void>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    })();
    const secondBuild = (() => {
      let resolve!: () => void;
      const promise = new Promise<void>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    })();
    const startBuild = jest
      .fn<Promise<void>, [BuildProfile]>()
      .mockImplementationOnce(async () => firstBuild.promise)
      .mockImplementationOnce(async () => secondBuild.promise);

    const { getByTestId } = render(
      <Harness
        profile="preview"
        repo="owner/repo"
        branch="main"
        startBuild={startBuild}
      />,
    );

    await pressRun(getByTestId);
    await waitFor(() => {
      expect(getByTestId("deploying").props.children).toBe("true");
      const buildStep = findStep(getSteps(getByTestId), "build");
      expect(buildStep.status).toBe("running");
    });

    await act(async () => {
      fireEvent.press(getByTestId("abort"));
      await Promise.resolve();
    });
    expect(getByTestId("deploying").props.children).toBe("false");
    const abortedSteps = getSteps(getByTestId);
    expect(findStep(abortedSteps, "build").detail).toContain("kann noch abschliessen");

    await pressRun(getByTestId);
    await waitFor(() => {
      expect(getByTestId("deploying").props.children).toBe("true");
    });

    await act(async () => {
      firstBuild.resolve();
      await Promise.resolve();
    });
    expect(getByTestId("deploying").props.children).toBe("true");

    await act(async () => {
      secondBuild.resolve();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(getByTestId("deploying").props.children).toBe("false");
      expect(getByTestId("done").props.children).toBe("true");
    });
  });


  it("blocks before build when diagnostic/ci-lite readiness is not green", async () => {
    mockEvaluateBuildReadiness.mockResolvedValueOnce({
      ok: false,
      reasonCode: "diagnostic_not_green",
      message: "Diagnose wurde fuer dieses Repo/Branch noch nicht sicher bestaetigt.",
      snapshot: null,
      context: {
        linkedRepo: "owner/repo",
        linkedBranch: "main",
        diagnosticOk: false,
      },
    });

    mockAsyncStorageGetItem.mockImplementation(async (k: string) => {
      if (k.includes("cred_key_exists_preview")) return "true";
      if (k === "diagnostic_last_ok::owner%2Frepo::main") return "false";
      if (k === "diagnostic_last_ok") return "true";
      return null;
    });

    mockGitHub.getGitHubToken.mockResolvedValue("gh");
    mockGitHub.getExpoToken.mockResolvedValue("expo");

    const startBuild = jest.fn(async () => {});
    const { getByTestId } = render(
      <Harness
        profile="preview"
        repo="owner/repo"
        branch="main"
        startBuild={startBuild}
      />,
    );

    await pressRun(getByTestId);

    await waitFor(() => {
      const steps = getSteps(getByTestId);
      const readiness = findStep(steps, "readiness");
      expect(readiness.status).toBe("fail");
    });

    const steps = getSteps(getByTestId);
    const build = findStep(steps, "build");
    expect(build.status).toBe("pending");
    expect(startBuild).not.toHaveBeenCalled();
  });

  it("does not treat a legacy global diagnostic flag as sufficient for the current repo/branch", async () => {
    mockEvaluateBuildReadiness.mockResolvedValueOnce({
      ok: false,
      reasonCode: "diagnostic_not_green",
      message: "Diagnose wurde fuer dieses Repo/Branch noch nicht sicher bestaetigt.",
      snapshot: null,
      context: {
        linkedRepo: "owner/repo",
        linkedBranch: "main",
        diagnosticOk: false,
      },
    });

    mockAsyncStorageGetItem.mockImplementation(async (k: string) => {
      if (k.includes("cred_key_exists_preview")) return "true";
      if (k === "diagnostic_last_ok") return "true";
      return null;
    });

    mockGitHub.getGitHubToken.mockResolvedValue("gh");
    mockGitHub.getExpoToken.mockResolvedValue("expo");

    const startBuild = jest.fn(async () => {});
    const { getByTestId } = render(
      <Harness
        profile="preview"
        repo="owner/repo"
        branch="main"
        startBuild={startBuild}
      />,
    );

    await pressRun(getByTestId);

    await waitFor(() => {
      const steps = getSteps(getByTestId);
      const readiness = findStep(steps, "readiness");
      expect(readiness.status).toBe("fail");
    });

    expect(startBuild).not.toHaveBeenCalled();
  });

  it("keeps readiness truth on canonical files even when raw project files are empty", async () => {
    mockAsyncStorageGetItem.mockImplementation(async (k: string) => {
      if (k.includes("cred_key_exists_preview")) return "true";
      if (k === "diagnostic_last_ok::owner%2Frepo::main") return "true";
      if (k === "ci_lite_lint_ok") return "true";
      if (k === "ci_lite_typecheck_ok") return "true";
      if (k === "ci_lite_last_repo") return "owner/repo";
      if (k === "ci_lite_last_branch") return "main";
      if (k === "ci_lite_last_run_at") return String(Date.now());
      if (k === "ci_lite_last_sha") return "a".repeat(40);
      return null;
    });

    mockGitHub.getGitHubToken.mockResolvedValue("gh");
    mockGitHub.getExpoToken.mockResolvedValue("expo");

    const startBuild = jest.fn(async () => {});
    const { getByTestId } = render(
      <Harness
        profile="preview"
        repo="owner/repo"
        branch="main"
        startBuild={startBuild}
      />,
    );

    await pressRun(getByTestId);

    await waitFor(() => {
      const steps = getSteps(getByTestId);
      const readiness = findStep(steps, "readiness");
      expect(readiness.status).toBe("ok");
    });

    expect(startBuild).toHaveBeenCalledTimes(1);
  });

  it("happy path: runs through to build when key exists", async () => {
    const sha = "a".repeat(40);
    mockProjectData.files = [{ path: "App.tsx", content: "export default 1;" }];
    const syncSignature = computeProjectFilesSignature(mockProjectData.files);
    mockAsyncStorageGetItem.mockImplementation(async (k: string) => {
      if (k.includes("cred_key_exists_preview")) return "true";
      if (k === "diagnostic_last_ok::owner%2Frepo::main") return "true";
      if (k === "ci_lite_lint_ok") return "true";
      if (k === "ci_lite_typecheck_ok") return "true";
      if (k === "ci_lite_last_repo") return "owner/repo";
      if (k === "ci_lite_last_branch") return "main";
      if (k === "ci_lite_last_run_at") return String(Date.now());
      if (k === "ci_lite_last_sha") return sha;
      if (k === "ci_lite_last_conclusion") return "success";
      if (k === "repo_sync_signature::owner%2Frepo::main") return syncSignature;
      return null;
    });

    mockGitHub.getGitHubToken.mockResolvedValue("gh");
    mockGitHub.getExpoToken.mockResolvedValue("expo");
    mockGitHub.getBranchHeadSha.mockResolvedValue(sha);
    mockSecrets.autoSyncRepoSecrets.mockResolvedValue({
      updated: [],
      skipped: [],
    });

    const startBuild = jest.fn(async () => {});
    const { getByTestId } = render(
      <Harness
        profile="preview"
        repo="owner/repo"
        branch="main"
        startBuild={startBuild}
      />,
    );

    await pressRun(getByTestId);

    await waitFor(() => {
      const steps = getSteps(getByTestId);
      const buildStep = findStep(steps, "build");
      expect(buildStep.status).toBe("ok");
    });

    const steps = getSteps(getByTestId);
    const pushFiles = findStep(steps, "push_files");
    const build = findStep(steps, "build");
    expect(pushFiles.status).toBe("skip");
    expect(["Repo-Sync erfolgt im Build-Start (SHA-sicher)", "Keine Dateien zum Synchronisieren"]).toContain(
      String(pushFiles.detail || ""),
    );
    expect(build.status).toBe("ok");
    expect(startBuild).toHaveBeenCalledTimes(1);
    expect(mockReadLocalBuildGateState).toHaveBeenCalledTimes(1);
  });

  it("uses one canonical file view for readiness and repo-sync checks in one-click flow", async () => {
    mockProjectData.files = [{ path: "App.tsx", content: "export default 1;" }];
    const startBuild = jest.fn(async () => {});
    const { getByTestId } = render(
      <Harness
        profile="preview"
        repo="owner/repo"
        branch="main"
        startBuild={startBuild}
      />,
    );

    await pressRun(getByTestId);
    await waitFor(() => {
      expect(findStep(getSteps(getByTestId), "build").status).toBe("ok");
    });

    expect(mockEvaluateBuildReadiness).toHaveBeenCalled();
    expect(mockGetRepoSyncState).toHaveBeenCalled();
    const readinessFiles = (mockEvaluateBuildReadiness.mock.calls.at(-1)?.[0]?.files ?? []) as Array<{
      path: string;
      content: string;
    }>;
    const syncFiles = (mockGetRepoSyncState.mock.calls.at(-1)?.[0]?.files ?? []) as Array<{
      path: string;
      content: string;
    }>;
    expect(computeProjectFilesSignature(readinessFiles)).toBe(computeProjectFilesSignature(syncFiles));
  });


  it("blocks before build when repo sync state is unknown", async () => {
    mockGetRepoSyncState.mockResolvedValueOnce("unknown");

    const sha = "a".repeat(40);
    mockProjectData.files = [{ path: "App.tsx", content: "export default 1;" }];
    mockAsyncStorageGetItem.mockImplementation(async (k: string) => {
      if (k.includes("cred_key_exists_preview")) return "true";
      if (k === "diagnostic_last_ok::owner%2Frepo::main") return "true";
      if (k === "ci_lite_lint_ok") return "true";
      if (k === "ci_lite_typecheck_ok") return "true";
      if (k === "ci_lite_last_repo") return "owner/repo";
      if (k === "ci_lite_last_branch") return "main";
      if (k === "ci_lite_last_run_at") return String(Date.now());
      if (k === "ci_lite_last_sha") return sha;
      return null;
    });

    mockGitHub.getGitHubToken.mockResolvedValue("gh");
    mockGitHub.getExpoToken.mockResolvedValue("expo");
    mockGitHub.getBranchHeadSha.mockResolvedValue(sha);

    const startBuild = jest.fn(async () => {});
    const { getByTestId } = render(
      <Harness
        profile="preview"
        repo="owner/repo"
        branch="main"
        startBuild={startBuild}
      />,
    );

    await pressRun(getByTestId);

    await waitFor(() => {
      const steps = getSteps(getByTestId);
      const readiness = findStep(steps, "readiness");
      expect(readiness.status).toBe("fail");
      expect(String(readiness.detail || "")).toMatch(/Repo-Sync-Status unklar/i);
    });

    expect(startBuild).not.toHaveBeenCalled();
  });

  it("blocks before build when CI-Lite SHA no longer matches the current branch head", async () => {
    mockEvaluateBuildReadiness.mockResolvedValueOnce({
      ok: false,
      reasonCode: "ci_lite_sha_mismatch",
      message: "SHA-Mismatch zwischen letztem CI-Lite-Run und aktuellem Branch-Head.",
      snapshot: null,
      context: {
        linkedRepo: "owner/repo",
        linkedBranch: "main",
        diagnosticOk: true,
      },
    });

    mockProjectData.files = [{ path: "App.tsx", content: "export default 1;" }];
    mockAsyncStorageGetItem.mockImplementation(async (k: string) => {
      if (k.includes("cred_key_exists_preview")) return "true";
      if (k === "diagnostic_last_ok::owner%2Frepo::main") return "true";
      if (k === "ci_lite_lint_ok") return "true";
      if (k === "ci_lite_typecheck_ok") return "true";
      if (k === "ci_lite_last_repo") return "owner/repo";
      if (k === "ci_lite_last_branch") return "main";
      if (k === "ci_lite_last_run_at") return String(Date.now());
      if (k === "ci_lite_last_sha") return "a".repeat(40);
      return null;
    });

    mockGitHub.getGitHubToken.mockResolvedValue("gh");
    mockGitHub.getExpoToken.mockResolvedValue("expo");
    mockGitHub.getBranchHeadSha.mockResolvedValue("b".repeat(40));

    const startBuild = jest.fn(async () => {});
    const { getByTestId } = render(
      <Harness
        profile="preview"
        repo="owner/repo"
        branch="main"
        startBuild={startBuild}
      />,
    );

    await pressRun(getByTestId);

    await waitFor(() => {
      const steps = getSteps(getByTestId);
      const readiness = findStep(steps, "readiness");
      expect(readiness.status).toBe("fail");
      expect(String(readiness.detail || "")).toMatch(/SHA-Mismatch/);
    });

    expect(startBuild).not.toHaveBeenCalled();
  });

  it("uses the same hard local gate blockers as normal start (workflow key/jwt)", async () => {
    mockReadLocalBuildGateState.mockResolvedValueOnce({
      hasTokens: true,
      tokenReason: null,
      hasWorkflowAdminKey: false,
      workflowAdminKeyReason: "Workflow-Admin-Key fehlt – im Verbindungen-Screen setzen",
      hasOperatorJwt: true,
      operatorJwtReason: null,
    });
    mockProjectData.files = [{ path: "App.tsx", content: "export default 1;" }];
    const startBuild = jest.fn(async () => {});

    const { getByTestId } = render(
      <Harness profile="preview" repo="owner/repo" branch="main" startBuild={startBuild} />,
    );

    await pressRun(getByTestId);

    await waitFor(() => {
      const steps = getSteps(getByTestId);
      const tokens = findStep(steps, "tokens");
      expect(tokens.status).toBe("fail");
      expect(String(tokens.detail || "")).toMatch(/Workflow-Admin-Key fehlt/i);
    });
    expect(startBuild).not.toHaveBeenCalled();
  });
});
