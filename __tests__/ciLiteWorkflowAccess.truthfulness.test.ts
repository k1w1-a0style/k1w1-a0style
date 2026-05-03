import { readOperatorJwtResult, resolveOperatorAccess } from "../components/CiLiteHeaderButton/hooks/useCiLiteWorkflowAccess";
import { ensureSupabaseClient } from "../lib/supabase";
import { getWorkflowAdminKey } from "../infra/github/githubService";

jest.mock("../lib/supabase", () => ({
  ensureSupabaseClient: jest.fn(),
}));

jest.mock("../infra/github/githubService", () => ({
  getWorkflowAdminKey: jest.fn(),
}));

describe("CiLite workflow access truthfulness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getWorkflowAdminKey as jest.Mock).mockResolvedValue("workflow-admin-key-12345678901234567890");
  });

  it("distinguishes supabase init failure while reading operator jwt", async () => {
    (ensureSupabaseClient as jest.Mock).mockRejectedValue(new Error("init boom"));

    await expect(readOperatorJwtResult("dispatch")).resolves.toEqual({ jwt: null, reason: "supabase_init_failed" });
  });

  it("distinguishes session unreadable from missing login", async () => {
    (ensureSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getSession: jest.fn().mockRejectedValue(new Error("session unreadable")),
      },
    });

    await expect(readOperatorJwtResult("dispatch")).resolves.toEqual({ jwt: null, reason: "session_unreadable" });
  });

  it("returns JWT-first access without requiring admin key when user session token exists", async () => {
    (ensureSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: "user-jwt-token" } } }),
      },
    });
    (getWorkflowAdminKey as jest.Mock).mockRejectedValue(new Error("must not be called"));

    await expect(resolveOperatorAccess("dispatch")).resolves.toEqual({ adminKey: "", userJwt: "user-jwt-token" });
  });

  it("uses admin fallback when session token is missing", async () => {
    (ensureSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      },
    });

    await expect(resolveOperatorAccess("dispatch")).resolves.toEqual({
      adminKey: "workflow-admin-key-12345678901234567890",
      userJwt: null,
    });
  });
});
