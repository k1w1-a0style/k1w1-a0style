import { requireOwnerOrJwtAuth } from "../supabase/functions/_shared/auth/scoped";

jest.mock("../supabase/functions/_shared/auth/jwt", () => {
  const actual = jest.requireActual("../supabase/functions/_shared/auth/jwt");
  return {
    ...actual,
    getBearerToken: jest.fn(actual.getBearerToken),
  };
});

describe("requireOwnerOrJwtAuth owner fallback contract", () => {
  const oldAnon = process.env.SUPABASE_ANON_KEY;
  const oldAdmin = process.env.K1W1_EDGE_WORKFLOW_ADMIN_KEY;

  beforeEach(() => {
    process.env.SUPABASE_ANON_KEY = "anon-key-123";
    process.env.K1W1_EDGE_WORKFLOW_ADMIN_KEY = "admin-key-123";
  });

  afterEach(() => {
    process.env.SUPABASE_ANON_KEY = oldAnon;
    process.env.K1W1_EDGE_WORKFLOW_ADMIN_KEY = oldAdmin;
  });

  it("accepts jwt-only path without admin header", async () => {
    const req = new Request("https://x.test", { headers: { Authorization: "Bearer user-jwt" } });
    const auth = await requireOwnerOrJwtAuth(req, {
      scope: "t",
      adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
      requireJwtRoleWithVerifiedActor: async () => ({ guard: null, actor: "user-1" }),
    });
    expect(auth.guard).toBeNull();
    expect(auth.via).toBe("jwt");
  });

  it("accepts owner fallback with anon+admin", async () => {
    const req = new Request("https://x.test", {
      headers: { Authorization: "Bearer anon-key-123", "x-k1w1-admin-key": "admin-key-123" },
    });
    const auth = await requireOwnerOrJwtAuth(req, { scope: "t", adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY" });
    expect(auth.guard).toBeNull();
    expect(auth.via).toBe("admin_key");
  });

  it("rejects admin-only", async () => {
    const req = new Request("https://x.test", { headers: { "x-k1w1-admin-key": "admin-key-123" } });
    const auth = await requireOwnerOrJwtAuth(req, { scope: "t", adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY" });
    expect(auth.guard).not.toBeNull();
  });

  it("rejects anon-only", async () => {
    const req = new Request("https://x.test", { headers: { Authorization: "Bearer anon-key-123" } });
    const auth = await requireOwnerOrJwtAuth(req, { scope: "t", adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY" });
    expect(auth.guard).not.toBeNull();
  });

  it("rejects invalid admin with anon bearer", async () => {
    const req = new Request("https://x.test", {
      headers: { Authorization: "Bearer anon-key-123", "x-k1w1-admin-key": "wrong-admin" },
    });
    const auth = await requireOwnerOrJwtAuth(req, { scope: "t", adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY" });
    expect(auth.guard).not.toBeNull();
  });
});
