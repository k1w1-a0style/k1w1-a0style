import React from "react";
import { Alert } from "react-native";
import { act, render, waitFor } from "@testing-library/react-native";
import { ProjectProvider, useProject } from "../contexts/ProjectContext";

const mockLoadProjectFromStorage = jest.fn();
const mockSaveProjectToStorage = jest.fn();
const mockLoadTemplateFromFile = jest.fn();

jest.mock("../infra/storage/projectPersistence", () => ({
  loadProjectFromStorage: (...args: any[]) => mockLoadProjectFromStorage(...args),
  saveProjectToStorage: (...args: any[]) => mockSaveProjectToStorage(...args),
}));

jest.mock("../project/services/templateLoader", () => ({
  loadTemplateFromFile: (...args: any[]) => mockLoadTemplateFromFile(...args),
}));

jest.mock("../hooks/useBuildStatus", () => ({
  useBuildStatus: () => ({ status: "idle", details: null, lastError: null }),
}));

describe("ProjectContext createNewProject regression", () => {
  let ctx: ReturnType<typeof useProject> | null = null;

  function Harness() {
    ctx = useProject();
    return null;
  }

  beforeEach(() => {
    ctx = null;
    jest.spyOn(Alert, "alert").mockImplementation((title: any, _message?: any, buttons?: any) => {
      if (title === "Neues Projekt") {
        const confirm = buttons?.find((b: any) => b.text === "Neu erstellen");
        confirm?.onPress?.();
      }
    });

    mockLoadTemplateFromFile.mockReset();
    mockLoadProjectFromStorage.mockReset();
    mockSaveProjectToStorage.mockReset();

    mockLoadProjectFromStorage.mockResolvedValue({
      id: "p1",
      name: "Initial",
      slug: "initial",
      templateId: "base",
      files: [{ path: "App.tsx", content: "export default function App(){return null}" }],
      chatHistory: [],
      createdAt: "2024-01-01T00:00:00.000Z",
      lastModified: "2024-01-01T00:00:00.000Z",
      preferredPreviewMode: "supabase",
    });

    mockSaveProjectToStorage.mockResolvedValue(undefined);
    mockLoadTemplateFromFile.mockImplementation(async (templateId?: string) => [
      { path: `template-${templateId ?? "auto"}.txt`, content: "ok" },
    ]);
  });

  afterEach(() => {
    (Alert.alert as jest.Mock).mockRestore?.();
  });

  it("uses the latest projectData values when creating a new project", async () => {
    render(
      <ProjectProvider>
        <Harness />
      </ProjectProvider>,
    );

    await waitFor(() => {
      expect(ctx?.projectData?.name).toBe("Initial");
    });

    await act(async () => {
      await ctx?.setTemplateId?.("crud");
      await ctx?.setPreferredPreviewMode?.("local");
    });

    await act(async () => {
      await ctx?.createNewProject();
    });

    await waitFor(() => {
      expect(ctx?.projectData?.templateId).toBe("crud");
      expect(ctx?.projectData?.preferredPreviewMode).toBe("local");
      expect(ctx?.projectData?.effectiveTemplateId).toBe("crud");
    });

    expect(mockLoadTemplateFromFile).toHaveBeenLastCalledWith("crud");
  });
});
