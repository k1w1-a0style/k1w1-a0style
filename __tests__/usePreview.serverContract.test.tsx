import { act, renderHook, waitFor } from "@testing-library/react-native";
import { usePreview } from "../hooks/usePreview";
import type { ProjectData } from "../shared/types/project";

const mockEnsureSupabaseClient = jest.fn(async () => ({}));
const mockGetEdgeAdminKey = jest.fn();
const mockBuildSandpackHtml = jest.fn((_opts?: unknown) => "<html><body>fallback</body></html>");
const mockSetLastPreview = jest.fn().mockResolvedValue(undefined);
const mockSetPreferredPreviewMode = jest.fn().mockResolvedValue(undefined);
const mockFetch = jest.fn();

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
    mockEnsureSupabaseClient.mockClear();
    mockGetEdgeAdminKey.mockReset();
    mockBuildSandpackHtml.mockClear();
    mockSetLastPreview.mockClear();
    mockSetPreferredPreviewMode.mockClear();
    mockFetch.mockReset();
    global.fetch = mockFetch as typeof fetch;
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://preview.example.com";
  });

  test("falls back locally when the preview server is unreachable and keeps the state honest", async () => {
    mockGetEdgeAdminKey.mockResolvedValue("edge-admin-key-12345678901234567890");
    mockFetch.mockRejectedValue(new Error("Network request failed"));

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
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("reports a present but rejected local Edge Admin Key as rejected instead of missing", async () => {
    mockGetEdgeAdminKey.mockResolvedValue("edge-admin-key-12345678901234567890");
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ ok: false, error: "missing or invalid admin key" }),
    });

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
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("uses only x-k1w1-admin-key for the remote preview admin-key fetch scope", async () => {
    mockGetEdgeAdminKey.mockResolvedValue("  edge-admin-key-12345678901234567890  ");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          previewUrl: "https://preview.example.com/session-headers",
          expiresAt: "2026-03-20T12:30:00.000Z",
        }),
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

    const fetchCall = mockFetch.mock.calls.at(-1);
    expect(fetchCall?.[0]).toBe("https://preview.example.com/functions/v1/save_preview");
    const fetchOpts = fetchCall?.[1] as { headers?: Record<string, string>; body?: string } | undefined;
    expect(fetchOpts?.headers).toEqual({
      "content-type": "application/json",
      "x-k1w1-admin-key": "edge-admin-key-12345678901234567890",
    });
    expect(fetchOpts?.headers).not.toHaveProperty("Authorization");
  });

  test("uses the trusted remote preview as primary path when the server responds successfully", async () => {
    mockGetEdgeAdminKey.mockResolvedValue("edge-admin-key-12345678901234567890");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          previewUrl: "https://preview.example.com/session-123",
          expiresAt: "2026-03-20T12:30:00.000Z",
        }),
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

  test("sends a non-empty files payload for a normal project", async () => {
    mockGetEdgeAdminKey.mockResolvedValue("edge-admin-key-12345678901234567890");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          previewUrl: "https://preview.example.com/session-payload",
          expiresAt: "2026-03-20T12:30:00.000Z",
        }),
    });

    const { result } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: {
        ...baseProject,
        files: [
          { path: "App.tsx", content: "export default function App() { return null; }" },
          { path: "package.json", content: JSON.stringify({ dependencies: { react: "^19.1.0" } }) },
        ],
      },
    });

    await act(async () => {
      await result.current.createPreview();
    });

    const fetchOpts = mockFetch.mock.calls.at(-1)?.[1] as { body?: string } | undefined;
    const payload = fetchOpts?.body ? JSON.parse(fetchOpts.body) : null;

    expect(payload?.files).toBeTruthy();
    expect(Object.keys(payload?.files ?? {})).not.toHaveLength(0);
    expect(payload?.files["/App.tsx"]).toEqual({
      contents: "export default function App() { return null; }",
    });
    expect(payload?.files["/src/index.tsx"]).toBeTruthy();
  });

  test("reports an honest payload/file reason when no remote-preview files survive filtering", async () => {
    mockGetEdgeAdminKey.mockResolvedValue("edge-admin-key-12345678901234567890");

    const { result } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: {
        ...baseProject,
        files: [{ path: "node_modules/demo/index.ts", content: "export default 1;" }],
      },
    });

    await act(async () => {
      await result.current.createPreview();
    });

    await waitFor(() => {
      expect(result.current.lastPreview?.source).toBe("local");
    });

    expect(result.current.state.remoteFailure).toBe(
      "Keine zulaessigen Projektdateien fuer Remote-Preview gefunden. 1 Datei(en) wurden vom Preview-Filter ausgeschlossen.",
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.lastPreview?.html).toContain("fallback");
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
