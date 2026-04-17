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

  test("distinguishes supabase init failures from missing login JWT", async () => {
    mockEnsureSupabaseClient.mockRejectedValueOnce(new Error("config unreadable"));

    const { result } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: baseProject,
    });

    await act(async () => {
      await expect(result.current.createPreview()).rejects.toThrow(PREVIEW_FAIL_CLOSED_MESSAGE);
    });

    expect(result.current.state.remoteFailure).toBe(
      "Remote-Preview blockiert: Supabase-Initialisierung fehlgeschlagen.",
    );
  });

  test("distinguishes session unreadable from missing login JWT", async () => {
    mockEnsureSupabaseClient.mockResolvedValueOnce({
      auth: {
        getSession: jest.fn().mockRejectedValue(new Error("secure storage read failed")),
      },
    });

    const { result } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: baseProject,
    });

    await act(async () => {
      await expect(result.current.createPreview()).rejects.toThrow(PREVIEW_FAIL_CLOSED_MESSAGE);
    });

    expect(result.current.state.remoteFailure).toBe(
      "Remote-Preview blockiert: Supabase-Session lokal nicht lesbar.",
    );
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

  test("uses canonical ops file materialization for preview payload instead of raw source snapshot", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          previewUrl: "https://preview.example.com/session-materialized",
          expiresAt: "2026-03-20T12:30:00.000Z",
        }),
    });

    const { result } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: {
        ...baseProject,
        name: "Canonical Preview App",
        slug: "canonical-preview-app",
        files: [
          {
            path: "app.json",
            content: JSON.stringify({
              expo: { name: "Old Name", slug: "old-slug", android: { package: "com.example.old" } },
            }),
          },
        ],
      },
    });

    await act(async () => {
      await result.current.createPreview();
    });

    const fetchOpts = mockFetch.mock.calls.at(-1)?.[1] as { body?: string } | undefined;
    const payload = fetchOpts?.body ? JSON.parse(fetchOpts.body) : null;
    const appJson = JSON.parse(payload?.files?.["/app.json"]?.contents ?? "{}");

    expect(appJson.expo?.name).toBe("Canonical Preview App");
    expect(appJson.expo?.slug).toBe("canonical-preview-app");
  });

  test("keeps preview payload non-empty via canonical materialization even when raw files are filtered", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          previewUrl: "https://preview.example.com/session-materialized-fallback",
          expiresAt: "2026-03-20T12:30:00.000Z",
        }),
    });

    const { result } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: {
        ...baseProject,
        files: [{ path: "node_modules/demo/index.ts", content: "export default 1;" }],
      },
    });

    await act(async () => {
      await result.current.createPreview();
    });

    const fetchOpts = mockFetch.mock.calls.at(-1)?.[1] as { body?: string } | undefined;
    const payload = fetchOpts?.body ? JSON.parse(fetchOpts.body) : null;
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(payload?.files?.["/app.json"]).toBeTruthy();
    expect(mockBuildSandpackHtml).not.toHaveBeenCalled();
  });

  test("stale preview finally must not clear the active in-flight request of a newer project", async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }) as Promise<unknown>,
    );

    const { result, rerender } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: baseProject,
    });

    let requestA: Promise<unknown>;
    await act(async () => {
      requestA = result.current.createPreview();
      await Promise.resolve();
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    rerender({
      ...baseProject,
      id: "preview-contract-b",
      name: "Project B",
      lastPreview: null,
    });

    let requestB: Promise<unknown>;
    await act(async () => {
      requestB = result.current.createPreview();
      await Promise.resolve();
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    resolvers[0]?.({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          previewUrl: "https://preview.example.com/session-a",
          expiresAt: "2026-03-20T12:30:00.000Z",
        }),
    });
    await requestA!;

    const duplicateStart = result.current.createPreview();
    expect(mockFetch).toHaveBeenCalledTimes(2);

    resolvers[1]?.({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          previewUrl: "https://preview.example.com/session-b",
          expiresAt: "2026-03-20T12:30:00.000Z",
        }),
    });

    await requestB!;
    await duplicateStart;
    await waitFor(() => {
      expect(result.current.lastPreview?.url).toBe("https://preview.example.com/session-b");
    });
  });

  test("late stale completion after project switch does not leave isCreating stuck", async () => {
    const fetchResolverRef: { current: ((value: unknown) => void) | null } = { current: null };
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          fetchResolverRef.current = resolve;
        }) as Promise<unknown>,
    );

    const { result, rerender } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: baseProject,
    });

    let requestA: Promise<unknown>;
    await act(async () => {
      requestA = result.current.createPreview();
      await Promise.resolve();
    });

    rerender({
      ...baseProject,
      id: "preview-contract-c",
      name: "Project C",
      lastPreview: null,
    });

    expect(result.current.state.isCreating).toBe(false);

    if (fetchResolverRef.current) {
      fetchResolverRef.current({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            previewUrl: "https://preview.example.com/session-a",
            expiresAt: "2026-03-20T12:30:00.000Z",
          }),
      });
    }
    await requestA!;

    expect(result.current.state.isCreating).toBe(false);
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
