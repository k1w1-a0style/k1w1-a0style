import {
  buildProjectForCreation,
  normalizeLoadedProjectData,
} from "../contexts/projectContextHelpers";

describe("projectContextHelpers", () => {
  describe("normalizeLoadedProjectData", () => {
    it("fills missing persisted arrays and preview mode defaults", () => {
      const normalized = normalizeLoadedProjectData({
        id: "p1",
        name: "Legacy",
        slug: "legacy",
        files: undefined as unknown as never,
        chatHistory: undefined as unknown as never,
        createdAt: "2024-01-01T00:00:00.000Z",
        lastModified: "2024-01-01T00:00:00.000Z",
        preferredPreviewMode: undefined as unknown as never,
      });

      expect(normalized.files).toEqual([]);
      expect(normalized.chatHistory).toEqual([]);
      expect(normalized.preferredPreviewMode).toBe("supabase");
    });

    it("keeps already persisted values unchanged", () => {
      const normalized = normalizeLoadedProjectData({
        id: "p1",
        name: "Current",
        slug: "current",
        files: [{ path: "App.tsx", content: "export default function App(){return null}" }],
        chatHistory: [
          {
            id: "m1",
            role: "user",
            content: "hello",
            timestamp: "2024-01-01T00:00:00.000Z",
          },
        ],
        createdAt: "2024-01-01T00:00:00.000Z",
        lastModified: "2024-01-01T00:00:00.000Z",
        preferredPreviewMode: "local",
      });

      expect(normalized.files).toHaveLength(1);
      expect(normalized.chatHistory).toHaveLength(1);
      expect(normalized.preferredPreviewMode).toBe("local");
    });
  });

  describe("buildProjectForCreation", () => {
    it("builds a new project with required defaults", () => {
      const created = buildProjectForCreation({
        id: "new-id",
        files: [{ path: "App.tsx", content: "app" }],
      });

      expect(created.id).toBe("new-id");
      expect(created.name).toBe("Neues Projekt");
      expect(created.slug).toBe("neues-projekt");
      expect(created.chatHistory).toEqual([]);
      expect(created.preferredPreviewMode).toBe("supabase");
      expect(created.files).toEqual([{ path: "App.tsx", content: "app" }]);
      expect(typeof created.createdAt).toBe("string");
      expect(typeof created.lastModified).toBe("string");
    });

    it("keeps optional template metadata when provided", () => {
      const created = buildProjectForCreation({
        id: "new-id",
        files: [{ path: "App.tsx", content: "app" }],
        templateId: "crud",
        effectiveTemplateId: "crud",
        preferredPreviewMode: "local",
      });

      expect(created.templateId).toBe("crud");
      expect(created.effectiveTemplateId).toBe("crud");
      expect(created.preferredPreviewMode).toBe("local");
    });
  });
});
