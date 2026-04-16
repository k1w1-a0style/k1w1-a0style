import {
  readCurrentUserJwt,
  readCurrentUserJwtResult,
} from "../screens/CredentialsWizardScreen/hooks/wizardEdgeAuth";
import { ensureSupabaseClient } from "../lib/supabase";

jest.mock("../lib/supabase", () => ({
  ensureSupabaseClient: jest.fn(),
}));

describe("credentials wizard edge auth helper", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns JWT when a session token exists", async () => {
    (ensureSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getSession: async () => ({ data: { session: { access_token: " user-jwt " } } }),
      },
    });
    const onError = jest.fn();

    const jwt = await readCurrentUserJwt({ onError });

    expect(jwt).toBe("user-jwt");
    expect(onError).not.toHaveBeenCalled();
  });

  it("returns null when JWT is missing", async () => {
    (ensureSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getSession: async () => ({ data: { session: null } }),
      },
    });

    const jwt = await readCurrentUserJwt({ onError: jest.fn() });

    expect(jwt).toBeNull();
  });

  it("returns null and reports errors via callback", async () => {
    const boom = new Error("session failed");
    (ensureSupabaseClient as jest.Mock).mockRejectedValue(boom);
    const onError = jest.fn();

    const jwt = await readCurrentUserJwt({ onError });

    expect(jwt).toBeNull();
    expect(onError).toHaveBeenCalledWith(boom);
  });

  it("distinguishes missing token from unreadable session reads", async () => {
    (ensureSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getSession: async () => {
          throw new Error("session storage failure");
        },
      },
    });
    const onError = jest.fn();

    const result = await readCurrentUserJwtResult({ onError });

    expect(result).toEqual({ jwt: null, reason: "session_unreadable" });
    expect(onError).toHaveBeenCalled();
  });

  it("reports supabase init failures separately from missing login", async () => {
    (ensureSupabaseClient as jest.Mock).mockRejectedValue(new Error("init failed"));

    const result = await readCurrentUserJwtResult({ onError: jest.fn() });

    expect(result).toEqual({ jwt: null, reason: "supabase_init_failed" });
  });
});
