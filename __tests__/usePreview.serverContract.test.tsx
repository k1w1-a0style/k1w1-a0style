import { act, renderHook, waitFor } from "@testing-library/react-native";
import { usePreview } from "../hooks/usePreview";
import type { ProjectData } from "../shared/types/project";

const mockEnsureSupabaseClient = jest.fn(async () => ({
  auth: {
    getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: "preview-user-jwt-token" } } }),
  },
}));
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

jest.mock("../lib/sandpackBuilder", () => ({
  buildSandpackHtml: (opts: unknown) => mockBuildSandpackHtml(opts),
}));

const originalSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const PREVIEW_FAIL_CLOSED_MESSAGE =
  "Remote-Preview im Standardpfad nicht verfuegbar. Entweder fehlt ein gueltiger Supabase-Login-JWT fuer save_preview oder der Edge-Call ist fehlgeschlagen; lokaler HTML-/Eval-Fallback bleibt nur im expliziten Local-/Dev-Modus.";

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
    mockBuildSandpackHtml.mockClear();
    mockSetLastPreview.mockClear();
    mockSetPreferredPreviewMode.mockClear();
    mockFetch.mockReset();
    global.fetch = mockFetch as typeof fetch;
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://preview.example.com";
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
  });

  test("uses Supabase preview in standard flow when a login JWT is present", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          previewUrl: "https://preview.example.com/p/1",
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
    expect(mockFetch).toHaveBeenCalled();
    expect(mockBuildSandpackHtml).not.toHaveBeenCalled();
  });


  test("reports a missing Supabase login JWT honestly and stays fail-closed in supabase mode", async () => {
    mockEnsureSupabaseClient.mockResolvedValueOnce({
      auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) },
    });

    const { result } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: baseProject,
    });

    await act(async () => {
      await expect(result.current.createPreview()).rejects.toThrow(PREVIEW_FAIL_CLOSED_MESSAGE);
    });

    await waitFor(() => {
      expect(result.current.lastPreview).toBeNull();
    });

    expect(result.current.state.remoteFailure).toBe(
      "Remote-Preview blockiert: Supabase-Login-JWT fehlt oder ist lokal nicht verfuegbar.",
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockBuildSandpackHtml).not.toHaveBeenCalled();
  });

  test("reports an unreachable preview server honestly", async () => {
    mockFetch.mockRejectedValue(new Error("Network request failed"));

    const { result } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: baseProject,
    });

    await act(async () => {
      await expect(result.current.createPreview()).rejects.toThrow(PREVIEW_FAIL_CLOSED_MESSAGE);
    });

    await waitFor(() => {
      expect(result.current.lastPreview).toBeNull();
    });

    expect(result.current.state.remoteFailure).toBe("Preview-Server derzeit nicht erreichbar.");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockBuildSandpackHtml).not.toHaveBeenCalled();
  });

  test("reports a rejected Supabase login JWT honestly without local admin-key fallback", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ ok: false, error: "missing or unverifiable JWT" }),
    });

    const { result } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: baseProject,
    });

    await act(async () => {
      await expect(result.current.createPreview()).rejects.toThrow(PREVIEW_FAIL_CLOSED_MESSAGE);
    });

    await waitFor(() => {
      expect(result.current.lastPreview).toBeNull();
    });

    expect(result.current.state.remoteFailure).toBe(
      "Remote-Preview blockiert: Der aktuelle Supabase-Login-JWT wurde vom Preview-Edge-Vertrag abgelehnt.",
    );
    expect(mockBuildSandpackHtml).not.toHaveBeenCalled();
  });

  test("sends only Authorization bearer JWT for the remote preview write scope", async () => {
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
      Authorization: "Bearer preview-user-jwt-token",
    });
  });

  test("uses the trusted remote preview as primary path when the server responds successfully", async () => {
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
    const { result } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: {
        ...baseProject,
        files: [{ path: "node_modules/demo/index.ts", content: "export default 1;" }],
      },
    });

    await act(async () => {
      await expect(result.current.createPreview()).rejects.toThrow(PREVIEW_FAIL_CLOSED_MESSAGE);
    });

    await waitFor(() => {
      expect(result.current.lastPreview).toBeNull();
    });

    expect(result.current.state.remoteFailure).toBe(
      "Keine zulaessigen Projektdateien fuer Remote-Preview gefunden. 1 Datei(en) wurden vom Preview-Filter ausgeschlossen.",
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockBuildSandpackHtml).not.toHaveBeenCalled();
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
    expect(mockSetPreferredPreviewMode).not.toHaveBeenCalledWith("local");
  });
});
