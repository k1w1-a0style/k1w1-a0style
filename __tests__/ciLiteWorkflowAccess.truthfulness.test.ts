import { readOperatorJwtResult, resolveOperatorAccess } from "../components/CiLiteHeaderButton/hooks/useCiLiteWorkflowAccess";
import { ensureSupabaseClient } from "../lib/supabase";
import { getWorkflowAdminKey } from "../infra/github/githubService";

jest.mock("../lib/supabase", () => ({
  ensureSupabaseClient: jest.fn(),
}));

jest.mock("../infra/github/githubService", () => ({
  getWorkflowAdminKey: jest.fn(),
}));

jest.mock("../components/CiLiteHeaderButton/hooks/useCiLiteWorkflowContracts", () => ({
  resolveCiLiteMissingJwtMessage: () => "MISSING_LOGIN",
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

  it("keeps missing-login message for real missing session token", async () => {
    (ensureSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      },
    });

    await expect(resolveOperatorAccess("dispatch")).rejects.toThrow("MISSING_LOGIN");
  });
});
