import React from "react";
import { Text, TouchableOpacity, Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

// IMPORTANT:
// We mock modules using absolute resolved paths so the mock matches deep-relative imports inside the hook.

const mockGitHub = {
  getGitHubToken: jest.fn(),
  getExpoToken: jest.fn(),
  pushFilesToRepo: jest.fn(),
};

const mockSecrets = {
  autoSyncRepoSecrets: jest.fn(),
};

const mockProject = {
  useProject: () => ({
    projectData: { files: [] },
  }),
};

// Mock AsyncStorage as a module (more reliable than spyOn for RN async storage)
const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
};

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: mockAsyncStorage,
}));

const ghServicePath = require.resolve("../infra/github/githubService");
const secretsPath = require.resolve("../lib/autoSyncRepoSecrets");
const projectCtxPath = require.resolve("../contexts/ProjectContext");

jest.doMock(ghServicePath, () => mockGitHub);
jest.doMock(secretsPath, () => mockSecrets);
jest.doMock(projectCtxPath, () => mockProject);

// Require AFTER mocks
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useOneClickDeploy } = require("../screens/EnhancedBuildScreen/hooks/useOneClickDeploy");

type HarnessProps = {
  profile: any;
  repo: string;
  branch: string;
  startBuild?: (profile: any) => Promise<void>;
};

function Harness(props: HarnessProps) {
  const hook = useOneClickDeploy(
    props.profile,
    props.repo,
    props.branch,
    props.startBuild,
  );

  return (
    <>
      {/*
        Do NOT return the Promise from the handler.
        If React test renderer awaits it, mocked storage/network can stall => timeout.
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
  return JSON.parse(getByTestId("steps").props.children);
}

describe("useOneClickDeploy", () => {
  beforeEach(() => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {});

    mockGitHub.getGitHubToken.mockReset();
    mockGitHub.getExpoToken.mockReset();
    mockGitHub.pushFilesToRepo.mockReset();
    mockSecrets.autoSyncRepoSecrets.mockReset();

    mockAsyncStorage.getItem.mockReset();
    mockAsyncStorage.setItem.mockReset();
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
      <Harness profile="preview" repo="owner/repo" branch="main" startBuild={startBuild} />,
    );

    fireEvent.press(getByTestId("run"));

    await waitFor(
      () => {
        const steps = getSteps(getByTestId);
        const signing = steps.find((s: any) => s.id === "signing_key");
        expect(signing.status).toBe("fail");
      },
      { timeout: 3000 },
    );

    const steps = getSteps(getByTestId);
    const tokens = steps.find((s: any) => s.id === "tokens");
    const build = steps.find((s: any) => s.id === "build");

    expect(tokens.status).toBe("pending");
    expect(build.status).toBe("pending");
    expect(startBuild).not.toHaveBeenCalled();
  });

  it("happy path: runs through to build when key exists", async () => {
    mockAsyncStorage.getItem.mockImplementation(async (k: string) => {
      if (k === "cred_key_exists_preview") return "true";
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
      <Harness profile="preview" repo="owner/repo" branch="main" startBuild={startBuild} />,
    );

    fireEvent.press(getByTestId("run"));

    await waitFor(
      () => {
        expect(getByTestId("done").props.children).toBe("true");
      },
      { timeout: 3000 },
    );

    const steps = getSteps(getByTestId);
    const build = steps.find((s: any) => s.id === "build");
    expect(build.status).toBe("ok");
    expect(startBuild).toHaveBeenCalledTimes(1);
  });
});
