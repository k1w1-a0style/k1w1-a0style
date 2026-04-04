import { Alert } from "react-native";

import {
  MISSING_OPERATOR_JWT_MESSAGE,
  MISSING_OPERATOR_JWT_TITLE,
  requireUserJwtOrAlert,
} from "../screens/CredentialsWizardScreen/hooks/wizardEdgeAuth";
import { ensureSupabaseClient } from "../lib/supabase";

jest.mock("../lib/supabase", () => ({
  ensureSupabaseClient: jest.fn(),
}));

describe("credentials wizard edge auth helper", () => {
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    alertSpy.mockRestore();
  });

  it("returns JWT when a session token exists", async () => {
    (ensureSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getSession: async () => ({ data: { session: { access_token: " user-jwt " } } }),
      },
    });
    const onError = jest.fn();

    const jwt = await requireUserJwtOrAlert({ onError });

    expect(jwt).toBe("user-jwt");
    expect(onError).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("alerts with explicit operator provisioning contract when JWT is missing", async () => {
    (ensureSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getSession: async () => ({ data: { session: null } }),
      },
    });

    const jwt = await requireUserJwtOrAlert({ onError: jest.fn() });

    expect(jwt).toBeNull();
    expect(alertSpy).toHaveBeenCalledWith(MISSING_OPERATOR_JWT_TITLE, MISSING_OPERATOR_JWT_MESSAGE);
  });
});
