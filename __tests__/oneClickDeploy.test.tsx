import React from "react";
import { Text, TouchableOpacity, Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const mockAsyncStorage = AsyncStorage as any;

// IMPORTANT:
// useOneClickDeploy imports deep-relative module ids like "../../../infra/github/githubService".
// If we mock with a *different* string, Jest won't apply the mock.
// Solution: mock by the resolved absolute file path (require.resolve), then require the hook AFTER mocks.

const mockGitHub = {
  getGitHubToken: jest.fn(),
  getExpoToken: jest.fn(),
};

const mockSecrets = {
  autoSyncRepoSecrets: jest.fn(),
};

const mockProject = {
  useProject: () => ({
    projectData: { files: [] },
  }),
};

// Mock modules by absolute path so it matches regardless of the importer relative string.
const ghServicePath = require.resolve("../infra/github/githubService");
const secretsPath = require.resolve("../lib/autoSyncRepoSecrets");
const projectCtxPath = require.resolve("../contexts/ProjectContext");

jest.doMock(ghServicePath, () => mockGitHub);
jest.doMock(secretsPath, () => mockSecrets);
jest.doMock(projectCtxPath, () => mockProject);

// Require AFTER mocks
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useOneClickDeploy } = require("../screens/EnhancedBuildScreen/hooks/useOneClickDeploy");

function Harness(props: {
  profile: any;
  repo: string;
  branch: string;
  startBuild?: (profile: any) => Promise<void>;
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

function getSteps(getByTestId: any) {
  const raw = getByTestId("steps").props.children;
  return JSON.parse(raw);
}

describe("useOneClickDeploy", () => {
  beforeAll(() => {
    jest.useRealTimers();
    jest.setTimeout(20000);
  });
  beforeEach(() => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {});

    mockGitHub.getGitHubToken.mockReset();
    mockGitHub.getExpoToken.mockReset();
    mockSecrets.autoSyncRepoSecrets.mockReset();
    // Reset AsyncStorage mocks per test
    mockAsyncStorage.getItem.mockReset();
    mockAsyncStorage.setItem.mockReset();
    mockAsyncStorage.removeItem?.mockReset?.();
  });

  afterEach(() => {
    (Alert.alert as any).mockRestore?.();
  });

  it("fails hard when signing key is missing (no skip)", async () => {
    // Signing key is missing => should fail BEFORE token step.
    mockAsyncStorage.getItem.mockImplementation(async (k: string) => {
      if (k === "cred_key_exists_preview") return null;
      return null;
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

    fireEvent.press(getByTestId("run"));

    await waitFor(
      () => {
        const steps = getSteps(getByTestId);
        const signing = steps.find((s: any) => s.id === "signing_key");
        expect(signing.status).toBe("fail");
      },
      { timeout: 12000 },
    );

    const steps = getSteps(getByTestId);
    const tokens = steps.find((s: any) => s.id === "tokens");
    const build = steps.find((s: any) => s.id === "build");

    expect(tokens.status).toBe("pending");
    expect(build.status).toBe("pending");
    expect(startBuild).not.toHaveBeenCalled();
  }, 30000);


  it("blocks before build when diagnostic/ci-lite readiness is not green", async () => {
    mockAsyncStorage.getItem.mockImplementation(async (k: string) => {
      if (k === "cred_key_exists_preview") return "true";
      if (k === "diagnostic_last_ok") return "false";
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

    fireEvent.press(getByTestId("run"));

    await waitFor(() => {
      const steps = getSteps(getByTestId);
      const readiness = steps.find((s: any) => s.id === "readiness");
      expect(readiness.status).toBe("fail");
    });

    const steps = getSteps(getByTestId);
    const build = steps.find((s: any) => s.id === "build");
    expect(build.status).toBe("pending");
    expect(startBuild).not.toHaveBeenCalled();
  });

  it("happy path: runs through to build when key exists", async () => {
    mockAsyncStorage.getItem.mockImplementation(async (k: string) => {
      if (k === "cred_key_exists_preview") return "true";
      if (k === "diagnostic_last_ok") return "true";
      if (k === "ci_lite_lint_ok") return "true";
      if (k === "ci_lite_typecheck_ok") return "true";
      if (k === "ci_lite_last_repo") return "owner/repo";
      if (k === "ci_lite_last_branch") return "main";
      if (k === "ci_lite_last_run_at") return String(Date.now());
      return null;
    });

    mockGitHub.getGitHubToken.mockResolvedValue("gh");
    mockGitHub.getExpoToken.mockResolvedValue("expo");
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

    fireEvent.press(getByTestId("run"));

    await waitFor(
      () => {
        const done = getByTestId("done").props.children;
        expect(done).toBe("true");
      },
      { timeout: 6000 },
    );

    const steps = getSteps(getByTestId);
    const pushFiles = steps.find((s: any) => s.id === "push_files");
    const build = steps.find((s: any) => s.id === "build");
    expect(pushFiles.status).toBe("skip");
    expect(["Repo-Sync erfolgt im Build-Start (SHA-sicher)", "Keine Dateien zum Synchronisieren"]).toContain(
      String(pushFiles.detail || ""),
    );
    expect(build.status).toBe("ok");
    expect(startBuild).toHaveBeenCalledTimes(1);
    expect(mockGitHub.getGitHubToken).toHaveBeenCalledTimes(1);
    expect(mockGitHub.getExpoToken).toHaveBeenCalledTimes(1);
  });
});
