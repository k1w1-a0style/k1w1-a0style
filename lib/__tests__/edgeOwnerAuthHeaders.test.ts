jest.mock("../supabaseRuntimeConfig", () => ({
  readSupabaseRuntimeConfigDetailed: jest.fn(),
}));

import { buildEdgeOwnerAuthHeaders } from "../edgeOwnerAuthHeaders";
import { readSupabaseRuntimeConfigDetailed } from "../supabaseRuntimeConfig";

const mockedRead = readSupabaseRuntimeConfigDetailed as jest.MockedFunction<typeof readSupabaseRuntimeConfigDetailed>;

describe("buildEdgeOwnerAuthHeaders", () => {
  beforeEach(() => {
    mockedRead.mockReset();
  });

  it("uses user JWT when available", async () => {
    const headers = await buildEdgeOwnerAuthHeaders({ action: "X", userJwt: "jwt", adminKey: "adm" });
    expect(headers["content-type"]).toBe("application/json");
    expect(headers.Authorization).toBe("Bearer jwt");
    expect(headers["x-k1w1-admin-key"]).toBe("adm");
  });

  it("uses anon key + admin key fallback", async () => {
    mockedRead.mockResolvedValue({ url: null, anonKey: "anon", urlReason: "missing", anonKeyReason: "ok" });
    const headers = await buildEdgeOwnerAuthHeaders({ action: "X", adminKey: "adm" });
    expect(headers.Authorization).toBe("Bearer anon");
    expect(headers["x-k1w1-admin-key"]).toBe("adm");
  });

  it("fails when both credentials missing", async () => {
    await expect(buildEdgeOwnerAuthHeaders({ action: "X" })).rejects.toThrow("Supabase-Login-JWT oder lokaler Admin-Key");
  });

  it("fails when admin fallback missing anon key", async () => {
    mockedRead.mockResolvedValue({ url: null, anonKey: null, urlReason: "missing", anonKeyReason: "missing" });
    await expect(buildEdgeOwnerAuthHeaders({ action: "X", adminKey: "adm" })).rejects.toThrow("Supabase-Anon-Key fehlt");
  });
  it("uses anonKeyOverride without runtime lookup", async () => {
    const headers = await buildEdgeOwnerAuthHeaders({ action: "X", adminKey: "adm", anonKeyOverride: "anon2" });
    expect(headers.Authorization).toBe("Bearer anon2");
    expect(mockedRead).not.toHaveBeenCalled();
  });

});
