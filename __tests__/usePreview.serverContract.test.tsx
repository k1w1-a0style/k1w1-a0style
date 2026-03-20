import { act, renderHook, waitFor } from "@testing-library/react-native";
import { usePreview } from "../hooks/usePreview";
import type { ProjectData } from "../shared/types/project";

const mockInvoke = jest.fn();
const mockEnsureSupabaseClient = jest.fn(async () => ({ functions: { invoke: mockInvoke } }));
const mockGetEdgeAdminKey = jest.fn();
const mockBuildSandpackHtml = jest.fn((_opts?: unknown) => "<html><body>fallback</body></html>");
const mockSetLastPreview = jest.fn().mockResolvedValue(undefined);
const mockSetPreferredPreviewMode = jest.fn().mockResolvedValue(undefined);

jest.mock("../contexts/ProjectContext", () => ({
  useProject: () => ({
    setLastPreview: mockSetLastPreview,
    setPreferredPreviewMode: mockSetPreferredPreviewMode,
  }),
}));

jest.mock("../lib/supabase", () => ({
  ensureSupabaseClient: () => mockEnsureSupabaseClient(),
}));

jest.mock("../infra/github/githubService", () => ({
  getEdgeAdminKey: () => mockGetEdgeAdminKey(),
}));

jest.mock("../lib/sandpackBuilder", () => ({
  buildSandpackHtml: (opts: unknown) => mockBuildSandpackHtml(opts),
}));

const baseProject: ProjectData = {
  id: "preview-contract",
  name: "Preview Contract",
  slug: "preview-contract",
  files: [{ path: "App.tsx", content: "export default function App() { return null; }" }],
  chatHistory: [],
  createdAt: "2026-03-19T10:00:00.000Z",
  lastModified: "2026-03-19T10:00:00.000Z",
  preferredPreviewMode: "supabase",
  lastPreview: null,
};

describe("usePreview server contract", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockEnsureSupabaseClient.mockClear();
    mockGetEdgeAdminKey.mockReset();
    mockBuildSandpackHtml.mockClear();
    mockSetLastPreview.mockClear();
    mockSetPreferredPreviewMode.mockClear();
  });

  test("falls back locally when the preview server is unreachable and keeps the state honest", async () => {
    mockGetEdgeAdminKey.mockResolvedValue("edge-admin-key");
    mockInvoke.mockRejectedValue(new Error("Network request failed"));

    const { result } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: baseProject,
    });

    await act(async () => {
      await result.current.createPreview();
    });

    await waitFor(() => {
      expect(result.current.lastPreview?.source).toBe("local");
    });

    expect(result.current.lastPreview?.html).toContain("fallback");
    expect(result.current.state.remoteFailure).toBe("Preview-Server derzeit nicht erreichbar.");
    expect(result.current.state.error).toBeNull();
  });

  test("keeps the existing legitimate local preview path working without remote server checks", async () => {
    const { result } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: {
        ...baseProject,
        preferredPreviewMode: "local",
      },
    });

    await act(async () => {
      await result.current.createPreview();
    });

    await waitFor(() => {
      expect(result.current.lastPreview?.source).toBe("local");
    });

    expect(mockEnsureSupabaseClient).not.toHaveBeenCalled();
    expect(result.current.state.remoteFailure).toBeNull();
    expect(result.current.lastPreview?.html).toContain("fallback");
  });
});
