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
const mockReadBuildReadinessState = jest.fn();
const mockGetRepoSyncState = jest.fn();

// Mock modules by absolute path so it matches regardless of the importer relative string.
const ghServicePath = require.resolve("../infra/github/githubService");
const secretsPath = require.resolve("../lib/autoSyncRepoSecrets");
const projectCtxPath = require.resolve("../contexts/ProjectContext");
const signingGatePath = require.resolve("../screens/EnhancedBuildScreen/hooks/signingKeyGate");
const buildReadinessPath = require.resolve("../screens/EnhancedBuildScreen/hooks/buildReadinessState");
const repoSyncPath = require.resolve("../lib/repoSyncOrchestration");

jest.doMock(ghServicePath, () => mockGitHub);
jest.doMock(secretsPath, () => mockSecrets);
jest.doMock(projectCtxPath, () => mockProject);
jest.doMock(signingGatePath, () => ({
  readSigningKeyGateState: mockReadSigningKeyGateState,
}));
jest.doMock(buildReadinessPath, () => ({
  readBuildReadinessState: mockReadBuildReadinessState,
}));
jest.doMock(repoSyncPath, () => ({
  getRepoSyncState: mockGetRepoSyncState,
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
      <Text testID="steps">{JSON.stringify(hook.steps)}</Text>
      <Text testID="done">{hook.deployDone ? "true" : "false"}</Text>
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
    mockReadBuildReadinessState.mockReset();
    mockReadBuildReadinessState.mockResolvedValue({
      hasDiagOk: true,
      hasCiLiteOk: true,
      diagnosticState: "verified",
      diagnosticReason: null,
      ciLiteReason: null,
      ciLiteState: "verified",
      ciLiteStale: false,
    });
    mockGetRepoSyncState.mockReset();
    mockGetRepoSyncState.mockResolvedValue("in_sync");
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


  it("blocks before build when diagnostic/ci-lite readiness is not green", async () => {
    mockReadBuildReadinessState.mockResolvedValueOnce({
      hasDiagOk: false,
      hasCiLiteOk: true,
      diagnosticState: "unknown",
      diagnosticReason: "Diagnose wurde fuer dieses Repo/Branch noch nicht sicher bestaetigt.",
      ciLiteReason: null,
      ciLiteState: "verified",
      ciLiteStale: false,
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
    mockReadBuildReadinessState.mockResolvedValueOnce({
      hasDiagOk: false,
      hasCiLiteOk: true,
      diagnosticState: "unknown",
      diagnosticReason: "Diagnose wurde fuer dieses Repo/Branch noch nicht sicher bestaetigt.",
      ciLiteReason: null,
      ciLiteState: "verified",
      ciLiteStale: false,
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

  it("fails readiness early when the project has no files", async () => {
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
      expect(readiness.status).toBe("fail");
      expect(String(readiness.detail || "")).toMatch(/Projekt ist leer/i);
    });

    expect(startBuild).not.toHaveBeenCalled();
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
    expect(mockGitHub.getGitHubToken).toHaveBeenCalledTimes(1);
    expect(mockGitHub.getExpoToken).toHaveBeenCalledTimes(1);
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
    mockReadBuildReadinessState.mockResolvedValueOnce({
      hasDiagOk: true,
      hasCiLiteOk: false,
      diagnosticState: "verified",
      diagnosticReason: null,
      ciLiteReason: "SHA-Mismatch zwischen letztem CI-Lite-Run und aktuellem Branch-Head.",
      ciLiteState: "unknown",
      ciLiteStale: false,
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
});
