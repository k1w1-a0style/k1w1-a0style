describe("lib/supabaseEdge startup validation", () => {
  const originalEnvUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    if (originalEnvUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = originalEnvUrl;
  });

  it("throws a clear error when no runtime/configured Supabase URL exists", async () => {
    jest.doMock("@react-native-async-storage/async-storage", () => ({
      __esModule: true,
      default: { getItem: jest.fn(async () => null) },
    }));
    jest.doMock("../config", () => ({
      CONFIG: { API: { SUPABASE_EDGE_URL: "" } },
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireSupabaseEdgeUrl, SUPABASE_URL_MISSING_ERROR } = require("../lib/supabaseEdge");
    await expect(requireSupabaseEdgeUrl()).rejects.toThrow(SUPABASE_URL_MISSING_ERROR);
  });

  it("normalizes runtime URLs to /functions/v1", async () => {
    jest.doMock("@react-native-async-storage/async-storage", () => ({
      __esModule: true,
      default: { getItem: jest.fn(async () => "https://project.supabase.co/") },
    }));
    jest.doMock("../config", () => ({
      CONFIG: { API: { SUPABASE_EDGE_URL: "https://static.invalid/functions/v1" } },
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSupabaseEdgeUrl } = require("../lib/supabaseEdge");
    await expect(getSupabaseEdgeUrl()).resolves.toBe("https://project.supabase.co/functions/v1");
  });

  it("ignores invalid mirror-only storage values and falls back to env", async () => {
    const getItem = jest
      .fn()
      .mockResolvedValueOnce("n/a")
      .mockResolvedValueOnce("not-a-url");
    jest.doMock("@react-native-async-storage/async-storage", () => ({
      __esModule: true,
      default: { getItem },
    }));
    jest.doMock("../config", () => ({
      CONFIG: { API: { SUPABASE_EDGE_URL: "https://static.invalid/functions/v1" } },
    }));
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://env-project.supabase.co/";

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSupabaseEdgeUrl } = require("../lib/supabaseEdge");
    await expect(getSupabaseEdgeUrl()).resolves.toBe("https://env-project.supabase.co/functions/v1");
  });
});
