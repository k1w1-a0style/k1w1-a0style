import { pollBuildStatusOnce } from "../project/services/buildPollingService";

jest.mock("../infra/github/githubService", () => ({
  getWorkflowAdminKey: jest.fn(async () => "workflow-key"),
}));

jest.mock("../lib/supabaseEdge", () => ({
  getSupabaseEdgeUrl: jest.fn(async () => "https://example.functions.supabase.co"),
  SUPABASE_URL_MISSING_ERROR: "SUPABASE_URL_MISSING_ERROR",
}));
jest.mock("../lib/supabase", () => ({
  ensureSupabaseClient: jest.fn(async () => ({
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { access_token: "supabase-authenticated-jwt-token" } },
      })),
    },
  })),
}));

function createAbortAwareFetchMock() {
  return jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    const signal = init?.signal;
    return new Promise<Response>((_resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason ?? Object.assign(new Error("Aborted"), { name: "AbortError" }));
        return;
      }

      signal?.addEventListener(
        "abort",
        () => {
          reject(signal.reason ?? Object.assign(new Error("Aborted"), { name: "AbortError" }));
        },
        { once: true },
      );
    });
  });
}

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

  it("sends JWT + x-k1w1-admin-key headers for check-eas-build", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, status: "queued" }),
    })) as unknown as typeof fetch;

    await pollBuildStatusOnce("job-headers");

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [RequestInfo | URL, RequestInit];
    expect((init.headers as Record<string, string>)?.Authorization).toBe(
      "Bearer supabase-authenticated-jwt-token",
    );
    expect((init.headers as Record<string, string>)?.["x-k1w1-admin-key"]).toBe("workflow-key");
  });

  it("preserves the shared timeout contract for poll requests", async () => {
    global.fetch = createAbortAwareFetchMock() as unknown as typeof fetch;

    await expect(pollBuildStatusOnce("job-timeout", { timeoutMs: 20 })).rejects.toMatchObject({
      name: "TimeoutError",
      message: "Request timeout - Keine Antwort vom Server",
      timeoutMs: 20,
    });
  });
});
