describe("lib/supabaseEdge startup validation", () => {
  const originalSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

  afterEach(() => {
    if (typeof originalSupabaseUrl === "string") {
      process.env.EXPO_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    } else {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    }
    jest.resetModules();
    jest.clearAllMocks();
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

  it("warns and falls back to static config when stored Supabase URL is unreadable", async () => {
    jest.doMock("@react-native-async-storage/async-storage", () => ({
      __esModule: true,
      default: { getItem: jest.fn(async () => { throw new Error("storage broken"); }) },
    }));
    jest.doMock("../config", () => ({
      CONFIG: { API: { SUPABASE_EDGE_URL: "https://static.invalid/functions/v1" } },
    }));
    const warn = jest.fn();
    jest.doMock("../lib/logger", () => ({
      logger: { warn },
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSupabaseEdgeUrl } = require("../lib/supabaseEdge");
    await expect(getSupabaseEdgeUrl()).resolves.toBe("https://static.invalid/functions/v1");
    expect(warn).toHaveBeenCalled();
  });
});
