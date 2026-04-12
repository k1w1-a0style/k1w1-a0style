import React from "react";
import { Alert, type AlertButton } from "react-native";
import { act, render, waitFor } from "@testing-library/react-native";

import { ProjectProvider, useProject } from "../contexts/ProjectContext";

jest.mock("../infra/storage/projectPersistence", () => ({
  loadProjectFromStorage: jest.fn(),
  saveProjectToStorage: jest.fn(),
}));

jest.mock("../project/services/templateLoader", () => ({
  loadTemplateFromFile: jest.fn(),
}));

jest.mock("../infra/github/githubService", () => ({
  getGitHubToken: jest.fn(async () => null),
  getWorkflowRuns: jest.fn(async () => []),
  saveGitHubToken: jest.fn(async () => undefined),
  saveExpoToken: jest.fn(async () => undefined),
  getExpoToken: jest.fn(async () => null),
  syncRepoSecrets: jest.fn(async () => ({ updated: [], skipped: [] })),
}));

jest.mock("../hooks/useBuildStatus", () => ({
  useBuildStatus: () => ({ status: "idle", details: null, lastError: null }),
}));

describe("ProjectContext persistence integrity", () => {
  const { loadProjectFromStorage: mockLoadProjectFromStorage, saveProjectToStorage: mockSaveProjectToStorage } =
    jest.requireMock("../infra/storage/projectPersistence") as {
      loadProjectFromStorage: jest.Mock;
      saveProjectToStorage: jest.Mock;
    };

  const { loadTemplateFromFile: mockLoadTemplateFromFile } =
    jest.requireMock("../project/services/templateLoader") as {
      loadTemplateFromFile: jest.Mock;
    };

  let ctx: ReturnType<typeof useProject> | null = null;

  function Harness() {
    ctx = useProject();
    return null;
  }

  beforeEach(() => {
    ctx = null;
    mockLoadProjectFromStorage.mockReset();
    mockSaveProjectToStorage.mockReset();
    mockLoadTemplateFromFile.mockReset();

    mockLoadProjectFromStorage.mockResolvedValue({
      id: "p1",
      name: "Initial",
      slug: "initial",
      files: [{ path: "App.tsx", content: "export default function App(){return null}" }],
      chatHistory: [],
      createdAt: "2024-01-01T00:00:00.000Z",
      lastModified: "2024-01-01T00:00:00.000Z",
      preferredPreviewMode: "supabase",
    });

    mockLoadTemplateFromFile.mockResolvedValue([{ path: "App.tsx", content: "new" }]);

    jest.spyOn(Alert, "alert").mockImplementation((...args: Parameters<typeof Alert.alert>) => {
      const [title, _message, buttons] = args;
      if (title === "Neues Projekt") {
        const confirm = (buttons ?? []).find((button: AlertButton) => button.text === "Neu erstellen");
        confirm?.onPress?.();
      }
    });
  });

  afterEach(() => {
    (Alert.alert as jest.Mock).mockRestore?.();
  });

  it("keeps in-memory state unchanged when replaceProjectData persistence fails", async () => {
    mockSaveProjectToStorage.mockImplementation(async (project: { name?: string }) => {
      if (project?.name === "Neues Projekt") {
        throw new Error("disk write failed");
      }
    });

    render(
      <ProjectProvider>
        <Harness />
      </ProjectProvider>,
    );

    await waitFor(() => {
      expect(ctx?.projectData?.name).toBe("Initial");
    });

    await act(async () => {
      await ctx?.createNewProject();
    });

    expect(ctx?.projectData?.name).toBe("Initial");
  });

  it("rejects invalid updateProjectFiles paths", async () => {
    mockSaveProjectToStorage.mockResolvedValue(undefined);

    render(
      <ProjectProvider>
        <Harness />
      </ProjectProvider>,
    );

    await waitFor(() => {
      expect(ctx?.projectData?.files?.length).toBeGreaterThan(0);
    });

    await expect(
      ctx?.updateProjectFiles([{ path: "../secret.txt", content: "oops" }]) ?? Promise.resolve(),
    ).rejects.toThrow("Ungültiger Dateipfad");

    expect(ctx?.projectData?.files.some((file) => file.path === "../secret.txt")).toBe(false);
  });
});
