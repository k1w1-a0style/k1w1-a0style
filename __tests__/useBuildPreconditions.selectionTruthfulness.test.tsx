import { renderHook, waitFor } from "@testing-library/react-native";

import { useBuildPreconditions } from "../screens/EnhancedBuildScreen/hooks/useBuildPreconditions";
import { getGitHubToken, getExpoToken, getWorkflowAdminKey } from "../infra/github/githubService";
import { readBuildReadinessState } from "../screens/EnhancedBuildScreen/hooks/buildReadinessState";
import { readSigningKeyGateState } from "../screens/EnhancedBuildScreen/hooks/signingKeyGate";
import { ensureSupabaseClient } from "../lib/supabase";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const ReactLocal = require("react");
    ReactLocal.useEffect(() => effect(), [effect]);
  },
}));

jest.mock("../infra/github/githubService", () => ({
  getGitHubToken: jest.fn(async () => "ghp_test"),
  getExpoToken: jest.fn(async () => "expo_test"),
  getWorkflowAdminKey: jest.fn(async () => "adminkey"),
}));

jest.mock("../lib/supabase", () => ({
  ensureSupabaseClient: jest.fn(async () => ({
    auth: {
      getSession: jest.fn(async () => ({
        data: {
          session: {
            access_token:
              "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYnVpbGRfYWRtaW4ifQ.signature",
          },
        },
      })),
    },
  })),
}));

jest.mock("../screens/EnhancedBuildScreen/hooks/buildReadinessState", () => ({
  readBuildReadinessState: jest.fn(),
}));

jest.mock("../screens/EnhancedBuildScreen/hooks/signingKeyGate", () => ({
  readSigningKeyGateState: jest.fn(async () => ({ hasSigningKey: true, reason: null, freshness: "fresh_valid" })),
}));

jest.mock("../lib/repoSyncOrchestration", () => ({
  getRepoSyncState: jest.fn(async () => "unknown"),
}));

const readBuildReadinessStateMock = readBuildReadinessState as jest.MockedFunction<typeof readBuildReadinessState>;
const readSigningKeyGateStateMock = readSigningKeyGateState as jest.MockedFunction<typeof readSigningKeyGateState>;
const getGitHubTokenMock = getGitHubToken as jest.MockedFunction<typeof getGitHubToken>;
const getExpoTokenMock = getExpoToken as jest.MockedFunction<typeof getExpoToken>;
const getWorkflowAdminKeyMock = getWorkflowAdminKey as jest.MockedFunction<typeof getWorkflowAdminKey>;
const ensureSupabaseClientMock = ensureSupabaseClient as jest.MockedFunction<typeof ensureSupabaseClient>;

describe("useBuildPreconditions selection truthfulness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getGitHubTokenMock.mockResolvedValue("ghp_test");
    getExpoTokenMock.mockResolvedValue("expo_test");
    getWorkflowAdminKeyMock.mockResolvedValue("adminkey");
    ensureSupabaseClientMock.mockResolvedValue({
      auth: {
        getSession: jest.fn(async () => ({
          data: {
            session: {
              access_token:
                "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYnVpbGRfYWRtaW4ifQ.signature",
            },
          },
        })),
      },
    } as unknown as Awaited<ReturnType<typeof ensureSupabaseClient>>);
    readSigningKeyGateStateMock.mockResolvedValue({
      hasSigningKey: true,
      reason: null,
      localEdgeAdminKeyPresent: true,
      credentialState: "verified",
      credentialDetail: null,
      freshness: "fresh_valid",
    });
    readBuildReadinessStateMock.mockResolvedValue({
      hasDiagOk: true,
      hasCiLiteOk: true,
      diagnosticState: "verified",
      diagnosticReason: null,
      ciLiteReason: null,
      ciLiteState: "verified",
      ciLiteStale: false,
    });
  });

  it("fails closed while repo or branch is missing and skips readiness reads", async () => {
    const { result } = renderHook(() =>
      useBuildPreconditions("preview", "", "", {
        id: "project-1",
        files: [{ path: "App.tsx", content: "export default 1;" }],
      }),
    );

    await waitFor(() => {
      expect(result.current.hasTokens).toBe(true);
      expect(result.current.hasDiagOk).toBe(false);
      expect(result.current.hasCiLiteOk).toBe(false);
    });

    expect(readBuildReadinessStateMock).not.toHaveBeenCalled();
    expect(result.current.diagnosticReason).toMatch(/Repo und Branch zuerst wählen/i);
    expect(result.current.ciLiteReason).toMatch(/Repo und Branch zuerst wählen/i);
    expect(result.current.repoSyncState).toBe("unknown");
  });

  it("classifies unreadable workflow admin key as read error (not missing)", async () => {
    getWorkflowAdminKeyMock.mockRejectedValue(new Error("securestore read failed"));

    const { result } = renderHook(() =>
      useBuildPreconditions("preview", "owner/repo", "main", {
        id: "project-1",
        files: [{ path: "App.tsx", content: "export default 1;" }],
      }),
    );

    await waitFor(() => {
      expect(result.current.hasWorkflowAdminKey).toBe(false);
      expect(String(result.current.workflowAdminKeyReason || "")).toMatch(/konnte nicht gelesen werden/i);
      expect(String(result.current.workflowAdminKeyReason || "")).not.toMatch(/fehlt/i);
    });
  });

  it("passes canonical project files into readiness read for stale verification invalidation", async () => {
    const { result } = renderHook(() =>
      useBuildPreconditions("preview", "owner/repo", "main", {
        id: "project-canonical",
        files: [{ path: "App.tsx", content: "export default 1;" }],
      }),
    );

    await waitFor(() => {
      expect(result.current.hasDiagOk).toBe(true);
    });

    expect(readBuildReadinessStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        repoFullName: "owner/repo",
        branchName: "main",
        projectFiles: expect.arrayContaining([
          expect.objectContaining({ path: "App.tsx", content: "export default 1;" }),
        ]),
      }),
    );
  });

  it("keeps operator jwt cases separated: missing vs unreadable vs unauthorized", async () => {
    getWorkflowAdminKeyMock.mockResolvedValue(null);
    ensureSupabaseClientMock.mockResolvedValue({
      auth: { getSession: jest.fn(async () => ({ data: { session: null } })) },
    } as unknown as Awaited<ReturnType<typeof ensureSupabaseClient>>);
    const missing = renderHook(() =>
      useBuildPreconditions("preview", "owner/repo", "main", {
        id: "project-1",
        files: [{ path: "App.tsx", content: "export default 1;" }],
      }),
    );
    await waitFor(() => {
      expect(missing.result.current.hasOperatorJwt).toBe(false);
      expect(String(missing.result.current.operatorJwtReason || "")).toMatch(/fehlt/i);
    });
    missing.unmount();

    ensureSupabaseClientMock.mockRejectedValue(new Error("session read failed"));
    const unreadable = renderHook(() =>
      useBuildPreconditions("preview", "owner/repo", "main", {
        id: "project-2",
        files: [{ path: "App.tsx", content: "export default 2;" }],
      }),
    );
    await waitFor(() => {
      expect(unreadable.result.current.hasOperatorJwt).toBe(false);
      expect(String(unreadable.result.current.operatorJwtReason || "")).toMatch(/konnte nicht gelesen werden/i);
    });
    unreadable.unmount();

    ensureSupabaseClientMock.mockResolvedValue({
      auth: {
        getSession: jest.fn(async () => ({
          data: {
            session: {
              access_token:
                "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.signature",
            },
          },
        })),
      },
    } as unknown as Awaited<ReturnType<typeof ensureSupabaseClient>>);
    const unauthorized = renderHook(() =>
      useBuildPreconditions("preview", "owner/repo", "main", {
        id: "project-3",
        files: [{ path: "App.tsx", content: "export default 3;" }],
      }),
    );
    await waitFor(() => {
      expect(unauthorized.result.current.hasOperatorJwt).toBe(false);
      expect(String(unauthorized.result.current.operatorJwtReason || "")).toMatch(/unauthorized/i);
      expect(String(unauthorized.result.current.operatorJwtReason || "")).not.toMatch(/fehlt/i);
    });
    unauthorized.unmount();
  });
  it("sets verifiedOperatorAccess via owner/admin fallback even without operator JWT", async () => {
    getWorkflowAdminKeyMock.mockResolvedValue("adminkey");
    ensureSupabaseClientMock.mockResolvedValue({
      auth: { getSession: jest.fn(async () => ({ data: { session: null } })) },
    } as unknown as Awaited<ReturnType<typeof ensureSupabaseClient>>);

    const { result } = renderHook(() =>
      useBuildPreconditions("preview", "owner/repo", "main", {
        id: "project-fallback",
        files: [{ path: "App.tsx", content: "export default 1;" }],
      }),
    );

    await waitFor(() => {
      expect(result.current.hasWorkflowAdminKey).toBe(true);
      expect(result.current.hasOperatorJwt).toBe(false);
      expect(result.current.verifiedOperatorAccess).toBe(true);
      expect(result.current.operatorJwtReason).toBeNull();
    });
  });

  it("keeps operator access blocked when both JWT and owner/admin fallback are unavailable", async () => {
    getWorkflowAdminKeyMock.mockResolvedValue(null);
    ensureSupabaseClientMock.mockResolvedValue({
      auth: { getSession: jest.fn(async () => ({ data: { session: null } })) },
    } as unknown as Awaited<ReturnType<typeof ensureSupabaseClient>>);

    const { result } = renderHook(() =>
      useBuildPreconditions("preview", "owner/repo", "main", {
        id: "project-no-access",
        files: [{ path: "App.tsx", content: "export default 1;" }],
      }),
    );

    await waitFor(() => {
      expect(result.current.hasWorkflowAdminKey).toBe(false);
      expect(result.current.hasOperatorJwt).toBe(false);
      expect(result.current.verifiedOperatorAccess).toBe(false);
      expect(String(result.current.operatorJwtReason || "")).toMatch(/fallback/i);
    });
  });

});
