import type { ProjectData, ProjectFile } from "../shared/types/project";
import {
  flushPendingProjectSave,
  initializeProjectData,
  shouldFlushProjectSaveOnAppState,
} from "../contexts/projectContextPersistenceHelpers";

const buildProject = (overrides?: Partial<ProjectData>): ProjectData => ({
  id: "project-id",
  name: "Demo",
  slug: "demo",
  files: [{ path: "README.md", content: "# demo" }],
  chatHistory: [],
  createdAt: "2026-04-01T00:00:00.000Z",
  lastModified: "2026-04-01T00:00:00.000Z",
  preferredPreviewMode: "supabase",
  ...overrides,
});

describe("projectContextPersistenceHelpers", () => {
  describe("initializeProjectData", () => {
    it("hydrates saved projects via normalizeLoadedProjectData", async () => {
      const saved = buildProject({
        slug: undefined as unknown as string,
        name: "Ä Demo",
      });

      const result = await initializeProjectData({
        loadProjectFromStorage: async () => saved,
        loadTemplateFromFile: async () => [{ path: "ignored", content: "" }],
        saveProjectToStorage: async () => undefined,
        createProjectId: () => "new-id",
      });

      expect(result.source).toBe("storage");
      expect(result.project.slug).toBe("a-demo");
      expect(result.project.id).toBe(saved.id);
    });

    it("creates and persists a template project when storage is empty", async () => {
      const templateFiles: ProjectFile[] = [{ path: "app.json", content: "{}" }];
      const saveProjectToStorage = jest.fn(async () => undefined);

      const result = await initializeProjectData({
        loadProjectFromStorage: async () => null,
        loadTemplateFromFile: async () => templateFiles,
        saveProjectToStorage,
        createProjectId: () => "generated-id",
      });

      expect(result.source).toBe("template");
      expect(result.project.id).toBe("generated-id");
      expect(result.project.files).toEqual(templateFiles);
      expect(saveProjectToStorage).toHaveBeenCalledWith(result.project);
    });
  });

  describe("background flush helpers", () => {
    it("detects background/inactive states", () => {
      expect(shouldFlushProjectSaveOnAppState("background")).toBe(true);
      expect(shouldFlushProjectSaveOnAppState("inactive")).toBe(true);
      expect(shouldFlushProjectSaveOnAppState("active")).toBe(false);
    });

    it("clears pending timeout and persists current project", async () => {
      const clearPendingSave = jest.fn();
      const saveProjectToStorage = jest.fn(async () => undefined);
      const project = buildProject();

      const didSave = await flushPendingProjectSave({
        saveTimeout: {} as ReturnType<typeof setTimeout>,
        clearPendingSave,
        projectData: project,
        saveProjectToStorage,
      });

      expect(clearPendingSave).toHaveBeenCalledTimes(1);
      expect(saveProjectToStorage).toHaveBeenCalledWith(project);
      expect(didSave).toBe(true);
    });

    it("no-ops when there is no project to save", async () => {
      const clearPendingSave = jest.fn();
      const saveProjectToStorage = jest.fn(async () => undefined);

      const didSave = await flushPendingProjectSave({
        saveTimeout: null,
        clearPendingSave,
        projectData: null,
        saveProjectToStorage,
      });

      expect(clearPendingSave).not.toHaveBeenCalled();
      expect(saveProjectToStorage).not.toHaveBeenCalled();
      expect(didSave).toBe(false);
    });
  });
});
