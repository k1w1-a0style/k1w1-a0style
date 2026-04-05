import type { ProjectData, ProjectFile } from "../shared/types/project";
import {
  clearPendingProjectSaveTimeout,
  createAppStateSaveHandler,
  createProjectSaveScheduler,
  flushProjectSaveForAppState,
  flushPendingProjectSave,
  hydrateChatRetentionLimit,
  initializeProjectData,
  scheduleDebouncedProjectSave,
  shouldFlushProjectSaveOnAppState,
} from "../contexts/projectContextPersistenceHelpers";
import { CHAT_HISTORY_RETENTION_FALLBACK } from "../contexts/projectContextStateHelpers";

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

    it("schedules debounced save and clears previous timeout first", () => {
      jest.useFakeTimers();
      const previousTimeout = {} as ReturnType<typeof setTimeout>;
      const clearTimeoutFn = jest.fn();
      const saveProjectToStorage = jest.fn(async () => undefined);
      const onSaveError = jest.fn();
      const project = buildProject();

      const timeoutHandle = scheduleDebouncedProjectSave({
        saveTimeout: previousTimeout,
        clearTimeoutFn,
        setTimeoutFn: setTimeout,
        debounceMs: 500,
        project,
        saveProjectToStorage,
        onSaveError,
      });

      expect(clearTimeoutFn).toHaveBeenCalledWith(previousTimeout);
      expect(timeoutHandle).toBeDefined();

      jest.advanceTimersByTime(500);
      expect(saveProjectToStorage).toHaveBeenCalledWith(project);
      expect(onSaveError).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it("returns null when clearPendingProjectSaveTimeout has no active timeout", () => {
      const clearTimeoutFn = jest.fn();

      const result = clearPendingProjectSaveTimeout({
        saveTimeout: null,
        clearTimeoutFn,
      });

      expect(result).toBeNull();
      expect(clearTimeoutFn).not.toHaveBeenCalled();
    });

    it("flushes only on background/inactive app states", async () => {
      const clearPendingSave = jest.fn();
      const saveProjectToStorage = jest.fn(async () => undefined);
      const project = buildProject();

      const activeSave = await flushProjectSaveForAppState({
        nextState: "active",
        saveTimeout: {} as ReturnType<typeof setTimeout>,
        clearPendingSave,
        projectData: project,
        saveProjectToStorage,
      });

      expect(activeSave).toBe(false);
      expect(clearPendingSave).not.toHaveBeenCalled();
      expect(saveProjectToStorage).not.toHaveBeenCalled();

      const backgroundSave = await flushProjectSaveForAppState({
        nextState: "background",
        saveTimeout: {} as ReturnType<typeof setTimeout>,
        clearPendingSave,
        projectData: project,
        saveProjectToStorage,
      });

      expect(backgroundSave).toBe(true);
      expect(clearPendingSave).toHaveBeenCalledTimes(1);
      expect(saveProjectToStorage).toHaveBeenCalledWith(project);
    });

    it("uses scheduler to debounce and flush app state saves with shared timeout state", async () => {
      jest.useFakeTimers();
      const saveProjectToStorage = jest.fn(async () => undefined);
      const onSaveError = jest.fn();
      const project = buildProject();
      const clearTimeoutFn = jest.fn((timeout: ReturnType<typeof setTimeout>) =>
        clearTimeout(timeout),
      );

      const scheduler = createProjectSaveScheduler({
        clearTimeoutFn,
        setTimeoutFn: setTimeout,
        debounceMs: 250,
        saveProjectToStorage,
        onSaveError,
      });

      scheduler.queueSave(project);
      expect(scheduler.getPendingTimeout()).not.toBeNull();

      const didSaveOnActive = await scheduler.flushForAppState("active", project);
      expect(didSaveOnActive).toBe(false);
      expect(saveProjectToStorage).not.toHaveBeenCalled();

      const didSaveOnBackground = await scheduler.flushForAppState(
        "background",
        project,
      );
      expect(didSaveOnBackground).toBe(true);
      expect(saveProjectToStorage).toHaveBeenCalledTimes(1);
      expect(clearTimeoutFn).toHaveBeenCalledTimes(1);
      expect(onSaveError).not.toHaveBeenCalled();
      expect(scheduler.getPendingTimeout()).toBeNull();

      jest.useRealTimers();
    });
  });


  describe("createAppStateSaveHandler", () => {
    it("skips active app state and does not invoke flush callbacks", async () => {
      const flushForAppState = jest.fn(async () => true);
      const onBeforeFlush = jest.fn();
      const onAfterFlush = jest.fn();

      const handler = createAppStateSaveHandler({
        flushForAppState,
        getProjectData: () => buildProject(),
        onBeforeFlush,
        onAfterFlush,
      });

      await handler("active");

      expect(flushForAppState).not.toHaveBeenCalled();
      expect(onBeforeFlush).not.toHaveBeenCalled();
      expect(onAfterFlush).not.toHaveBeenCalled();
    });

    it("flushes on background and reports save result", async () => {
      const project = buildProject();
      const flushForAppState = jest.fn(async () => true);
      const onBeforeFlush = jest.fn();
      const onAfterFlush = jest.fn();

      const handler = createAppStateSaveHandler({
        flushForAppState,
        getProjectData: () => project,
        onBeforeFlush,
        onAfterFlush,
      });

      await handler("background");

      expect(onBeforeFlush).toHaveBeenCalledTimes(1);
      expect(flushForAppState).toHaveBeenCalledWith("background", project);
      expect(onAfterFlush).toHaveBeenCalledWith(true);
    });

    it("routes flush errors to onFlushError", async () => {
      const flushError = new Error("save failed");
      const flushForAppState = jest.fn(async () => {
        throw flushError;
      });
      const onFlushError = jest.fn();

      const handler = createAppStateSaveHandler({
        flushForAppState,
        getProjectData: () => buildProject(),
        onFlushError,
      });

      await handler("inactive");

      expect(onFlushError).toHaveBeenCalledWith(flushError);
    });
  });

  describe("retention hydration helper", () => {
    it("returns hydrated retention when runtime override was not set", async () => {
      const value = await hydrateChatRetentionLimit({
        loadChatHistorySettings: async () => ({ retention: 77 }),
        shouldApplyHydratedRetention: (didSetRuntimeRetention) =>
          !didSetRuntimeRetention,
        didSetRuntimeRetention: false,
      });
      expect(value).toBe(77);
    });

    it("does not hydrate when runtime value was already set", async () => {
      const loadChatHistorySettings = jest.fn(async () => ({ retention: 50 }));
      const value = await hydrateChatRetentionLimit({
        loadChatHistorySettings,
        shouldApplyHydratedRetention: (didSetRuntimeRetention) =>
          !didSetRuntimeRetention,
        didSetRuntimeRetention: true,
      });
      expect(value).toBeNull();
      expect(loadChatHistorySettings).not.toHaveBeenCalled();
    });

    it("falls back to retention fallback on read errors", async () => {
      const value = await hydrateChatRetentionLimit({
        loadChatHistorySettings: async () => {
          throw new Error("storage down");
        },
        shouldApplyHydratedRetention: () => true,
        didSetRuntimeRetention: false,
      });
      expect(value).toBe(CHAT_HISTORY_RETENTION_FALLBACK);
    });
  });
});
