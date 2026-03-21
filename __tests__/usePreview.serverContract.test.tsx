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
    mockGetEdgeAdminKey.mockResolvedValue("edge-admin-key-12345678901234567890");
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


  test("reports a missing local Edge Admin Key honestly before falling back to the local preview", async () => {
    mockGetEdgeAdminKey.mockResolvedValue(null);

    const { result } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: baseProject,
    });

    await act(async () => {
      await result.current.createPreview();
    });

    await waitFor(() => {
      expect(result.current.lastPreview?.source).toBe("local");
    });

    expect(result.current.state.remoteFailure).toBe(
      "Remote-Preview blockiert: Lokaler Edge Admin Key fehlt. Repo-/Server-Secrets koennen vorhanden sein, aber Wizard, Remote-Preview und Build-Vorbereitung brauchen diesen lokalen App-Wert fuer geschuetzte Edge-Calls.",
    );
    expect(mockEnsureSupabaseClient).toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test("reports a present but rejected local Edge Admin Key as rejected instead of missing", async () => {
    mockGetEdgeAdminKey.mockResolvedValue("edge-admin-key-12345678901234567890");
    mockInvoke.mockRejectedValue(new Error("401 missing or invalid admin key"));

    const { result } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: baseProject,
    });

    await act(async () => {
      await result.current.createPreview();
    });

    await waitFor(() => {
      expect(result.current.lastPreview?.source).toBe("local");
    });

    expect(result.current.state.remoteFailure).toBe(
      "Remote-Preview blockiert: Lokaler Edge Admin Key ist lokal vorhanden und wurde fuer den geschuetzten Edge-Request verwendet, aber vom Edge-Server abgelehnt (401/403 bzw. invalid admin). Bitte den lokalen App-Key neu speichern oder korrekt importieren.",
    );
    expect(result.current.state.remoteFailure).not.toMatch(/fehlt oder wurde/i);
  });

  test("reports a formally invalid local Edge Admin Key as invalid before any remote call", async () => {
    mockGetEdgeAdminKey.mockResolvedValue("short key");

    const { result } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: baseProject,
    });

    await act(async () => {
      await result.current.createPreview();
    });

    await waitFor(() => {
      expect(result.current.lastPreview?.source).toBe("local");
    });

    expect(result.current.state.remoteFailure).toBe(
      "Remote-Preview blockiert: Lokaler Edge Admin Key wirkt ungueltig (leer/zu kurz/Whitespace). Bitte in der App neu speichern oder importieren.",
    );
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test("uses the trusted remote preview as primary path when the server responds successfully", async () => {
    mockGetEdgeAdminKey.mockResolvedValue("edge-admin-key-12345678901234567890");
    mockInvoke.mockResolvedValue({
      data: {
        ok: true,
        previewUrl: "https://preview.example.com/session-123",
        expiresAt: "2026-03-20T12:30:00.000Z",
      },
      error: null,
    });

    const { result } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: baseProject,
    });

    await act(async () => {
      await result.current.createPreview();
    });

    await waitFor(() => {
      expect(result.current.lastPreview?.source).toBe("supabase");
    });

    expect(result.current.lastPreview?.url).toBe("https://preview.example.com/session-123");
    expect(result.current.lastPreview?.html).toBeNull();
    expect(result.current.state.remoteFailure).toBeNull();
    expect(mockBuildSandpackHtml).not.toHaveBeenCalled();
    expect(mockSetPreferredPreviewMode).toHaveBeenCalledWith("supabase");
  });

  test("keeps the existing explicit local dev fallback path working without remote server checks", async () => {
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
