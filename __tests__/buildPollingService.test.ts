import { pollBuildStatusOnce, fetchWithTimeout } from "../project/services/buildPollingService";

jest.mock("../infra/github/githubService", () => ({
  getEdgeAdminKey: jest.fn(async () => "admin-key"),
}));

jest.mock("../lib/supabaseEdge", () => ({
  getSupabaseEdgeUrl: jest.fn(async () => "https://example.functions.supabase.co"),
  SUPABASE_URL_MISSING_ERROR: "SUPABASE_URL_MISSING_ERROR",
}));

describe("buildPollingService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns normalized error when response is non-json", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("invalid json");
      },
    })) as unknown as typeof fetch;

    const result = await pollBuildStatusOnce("job-1");

    expect(result).toEqual({
      ok: false,
      error: "Ungültige Server-Antwort",
      statusCode: 200,
    });
  });

  it("maps legacy payload fields without any-casts", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        run_id: "123",
        download_url: "https://download.example/app.apk",
        status: "success",
      }),
    })) as unknown as typeof fetch;

    const result = await pollBuildStatusOnce("job-2");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.details.runId).toBe(123);
    expect(result.details.urls?.buildUrl).toBe("https://download.example/app.apk");
    expect(result.status).toBe("success");
  });

  it("converts AbortError to timeout message", async () => {
    global.fetch = jest.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }) as unknown as typeof fetch;

    await expect(fetchWithTimeout("https://example.com", { method: "GET" }, 20)).rejects.toThrow(
      "Request timeout - Keine Antwort vom Server",
    );
  });
});
