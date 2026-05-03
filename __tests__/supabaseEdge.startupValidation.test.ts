describe("lib/supabaseEdge startup validation", () => {
  const envKeys = [
    "EXPO_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
    "K1W1_SUPABASE_URL",
    "EXPO_PUBLIC_SUPABASE_EDGE_URL",
    "EDGE_BASE_URL",
  ] as const;
  const originalEnv = new Map<string, string | undefined>(envKeys.map((key) => [key, process.env[key]]));

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    for (const key of envKeys) {
      const originalValue = originalEnv.get(key);
      if (originalValue === undefined) delete process.env[key];
      else process.env[key] = originalValue;
    }
  });

  it("throws a clear error when no runtime/configured Supabase URL exists", async () => {
    jest.doMock("@react-native-async-storage/async-storage", () => ({
      __esModule: true,
      default: { getItem: jest.fn(async () => null) },
    }));
    jest.doMock("../config", () => ({
      CONFIG: { API: { SUPABASE_EDGE_URL: "" } },
    }));
    for (const key of envKeys) delete process.env[key];

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
