import {
  buildProjectForCreation,
  normalizeLoadedProjectData,
  normalizeProjectSlug,
  removeProjectFilesByPaths,
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

      expect(normalized.files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "app.json" }),
        ]),
      );
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

      expect(normalized.files).toEqual(
        expect.arrayContaining([
          { path: "App.tsx", content: "export default function App(){return null}" },
          expect.objectContaining({ path: "app.json" }),
        ]),
      );
      expect(normalized.chatHistory).toHaveLength(1);
      expect(normalized.preferredPreviewMode).toBe("local");
    });

    it("materializes loaded files into canonical ops state immediately", () => {
      const normalized = normalizeLoadedProjectData({
        id: "p1",
        name: "Canonical Demo",
        slug: "canonical-demo",
        files: [
          {
            path: "app.json",
            content: JSON.stringify({
              expo: { name: "Legacy", slug: "legacy" },
            }),
          },
        ],
        chatHistory: [],
        createdAt: "2024-01-01T00:00:00.000Z",
        lastModified: "2024-01-01T00:00:00.000Z",
        preferredPreviewMode: "supabase",
      });

      const appJsonFile = normalized.files.find((file) => file.path === "app.json");
      const appJson = JSON.parse(String(appJsonFile?.content ?? "{}"));
      expect(appJson.expo?.name).toBe("Canonical Demo");
      expect(appJson.expo?.slug).toBe("canonical-demo");
    });

    it("keeps slug parity for legacy umlaut/accent inputs across state and materialized app/package config", () => {
      const normalized = normalizeLoadedProjectData({
        id: "p-legacy",
        name: "Äccent Müse App",
        slug: "über unsauber!!!",
        files: [
          {
            path: "app.json",
            content: JSON.stringify({
              expo: { name: "Legacy Name", slug: "legacy slug" },
            }),
          },
          {
            path: "package.json",
            content: JSON.stringify({
              name: "legacy-package-name",
              version: "1.0.0",
            }),
          },
        ],
        chatHistory: [],
        createdAt: "2024-01-01T00:00:00.000Z",
        lastModified: "2024-01-01T00:00:00.000Z",
        preferredPreviewMode: "supabase",
      });

      const appJsonFile = normalized.files.find((file) => file.path === "app.json");
      const packageJsonFile = normalized.files.find((file) => file.path === "package.json");
      const appJson = JSON.parse(String(appJsonFile?.content ?? "{}"));
      const packageJson = JSON.parse(String(packageJsonFile?.content ?? "{}"));

      expect(normalized.slug).toBe("uber-unsauber");
      expect(appJson.expo?.slug).toBe(normalized.slug);
      expect(packageJson.name).toBe(normalized.slug);
    });

    it("falls back from missing/invalid legacy slug to canonical slug without hydration drift", () => {
      const normalized = normalizeLoadedProjectData({
        id: "p-missing-slug",
        name: "  Café Déjà Vu App  ",
        slug: "!!!",
        files: [
          {
            path: "app.json",
            content: JSON.stringify({
              expo: { name: "Old", slug: "broken slug ###" },
            }),
          },
        ],
        chatHistory: [],
        createdAt: "2024-01-01T00:00:00.000Z",
        lastModified: "2024-01-01T00:00:00.000Z",
        preferredPreviewMode: "supabase",
      });

      const appJsonFile = normalized.files.find((file) => file.path === "app.json");
      const appJson = JSON.parse(String(appJsonFile?.content ?? "{}"));

      expect(normalized.slug).toBe("cafe-deja-vu-app");
      expect(appJson.expo?.slug).toBe("cafe-deja-vu-app");
    });
  });

  describe("normalizeProjectSlug", () => {
    it("creates a deterministic fallback slug from the project name", () => {
      expect(normalizeProjectSlug("  Demo App 42  ")).toBe("demo-app-42");
    });

    it("falls back to the default slug when the input is empty", () => {
      expect(normalizeProjectSlug("   ")).toBe("neues-projekt");
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

  describe("removeProjectFilesByPaths", () => {
    it("removes files by path while preserving order of remaining entries", () => {
      const files = [
        { path: "a.ts", content: "a" },
        { path: "b.ts", content: "b" },
        { path: "c.ts", content: "c" },
      ];

      const updated = removeProjectFilesByPaths(files, ["b.ts"]);

      expect(updated).toEqual([
        { path: "a.ts", content: "a" },
        { path: "c.ts", content: "c" },
      ]);
    });

    it("ignores empty and non-string delete candidates", () => {
      const files = [{ path: "App.tsx", content: "app" }];

      const updated = removeProjectFilesByPaths(files, ["", null as unknown as string]);

      expect(updated).toBe(files);
      expect(updated).toEqual([{ path: "App.tsx", content: "app" }]);
    });

    it("uses canonical path normalization for delete matching", () => {
      const files = [{ path: "src/App.tsx", content: "app" }];

      const updated = removeProjectFilesByPaths(files, ["./src//App.tsx"]);

      expect(updated).toEqual([]);
    });
  });
});
