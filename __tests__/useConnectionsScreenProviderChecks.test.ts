import { runSupabaseConnectionCheck } from "../screens/ConnectionsScreen/hooks/useConnectionsScreenProviderChecks";
import { fetchWithTimeout } from "../lib/network/fetchWithTimeout";

jest.mock("../lib/network/fetchWithTimeout", () => ({
  fetchWithTimeout: jest.fn(),
}));

const mockedFetchWithTimeout = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>;

describe("useConnectionsScreenProviderChecks", () => {
  beforeEach(() => {
    mockedFetchWithTimeout.mockReset();
  });

  it("maps supabase 401/403 build_jobs as rls_protected", async () => {
    mockedFetchWithTimeout
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response);

    await expect(
      runSupabaseConnectionCheck("https://abc123.supabase.co", "anon"),
    ).resolves.toEqual({ kind: "rls_protected" });
  });

  it("returns supabase ref on successful rest+build_jobs checks", async () => {
    mockedFetchWithTimeout
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

    await expect(
      runSupabaseConnectionCheck("https://abc123.supabase.co", "anon"),
    ).resolves.toEqual({ kind: "ok", ref: "abc123" });
  });
});
