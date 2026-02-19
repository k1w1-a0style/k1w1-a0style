import React from "react";
import { Text, TouchableOpacity, Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// IMPORTANT:
// useOneClickDeploy imports deep-relative module ids like "../../../infra/github/githubService".
// If we mock with a *different* string, Jest won't apply the mock.
// Solution: mock by the resolved absolute file path (require.resolve), then require the hook AFTER mocks.

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
  beforeEach(() => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {});

    mockGitHub.getGitHubToken.mockReset();
    mockGitHub.getExpoToken.mockReset();
    mockGitHub.pushFilesToRepo.mockReset();
    mockSecrets.autoSyncRepoSecrets.mockReset();

    // Make AsyncStorage deterministic per test. Some setups keep a global store between tests.
    jest.spyOn(AsyncStorage, "getItem");
    jest.spyOn(AsyncStorage, "setItem");
  });

  afterEach(() => {
    (AsyncStorage.getItem as any).mockRestore?.();
    (AsyncStorage.setItem as any).mockRestore?.();
    (Alert.alert as any).mockRestore?.();
  });

  it("fails hard when signing key is missing (no skip)", async () => {
    // Signing key is missing => should fail BEFORE token step.
    (AsyncStorage.getItem as any).mockImplementation(async (k: string) => {
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
      { timeout: 2000 },
    );

    const steps = getSteps(getByTestId);
    const tokens = steps.find((s: any) => s.id === "tokens");
    const build = steps.find((s: any) => s.id === "build");

    expect(tokens.status).toBe("pending");
    expect(build.status).toBe("pending");
    expect(startBuild).not.toHaveBeenCalled();
  });

  it("happy path: runs through to build when key exists", async () => {
    (AsyncStorage.getItem as any).mockImplementation(async (k: string) => {
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
      { timeout: 2000 },
    );

    const steps = getSteps(getByTestId);
    const build = steps.find((s: any) => s.id === "build");
    expect(build.status).toBe("ok");
    expect(startBuild).toHaveBeenCalledTimes(1);
  });
});
