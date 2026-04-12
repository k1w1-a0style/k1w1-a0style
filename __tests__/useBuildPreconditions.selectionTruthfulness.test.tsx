import { renderHook, waitFor } from "@testing-library/react-native";

import { useBuildPreconditions } from "../screens/EnhancedBuildScreen/hooks/useBuildPreconditions";
import { getGitHubToken, getExpoToken, getWorkflowAdminKey } from "../infra/github/githubService";
import { readBuildReadinessState } from "../screens/EnhancedBuildScreen/hooks/buildReadinessState";
import { readSigningKeyGateState } from "../screens/EnhancedBuildScreen/hooks/signingKeyGate";

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
  readSigningKeyGateState: jest.fn(async () => ({ hasSigningKey: true, reason: null })),
}));

jest.mock("../lib/repoSyncOrchestration", () => ({
  getRepoSyncState: jest.fn(async () => "unknown"),
}));

const readBuildReadinessStateMock = readBuildReadinessState as jest.MockedFunction<typeof readBuildReadinessState>;
const readSigningKeyGateStateMock = readSigningKeyGateState as jest.MockedFunction<typeof readSigningKeyGateState>;
const getGitHubTokenMock = getGitHubToken as jest.MockedFunction<typeof getGitHubToken>;
const getExpoTokenMock = getExpoToken as jest.MockedFunction<typeof getExpoToken>;
const getWorkflowAdminKeyMock = getWorkflowAdminKey as jest.MockedFunction<typeof getWorkflowAdminKey>;

describe("useBuildPreconditions selection truthfulness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getGitHubTokenMock.mockResolvedValue("ghp_test");
    getExpoTokenMock.mockResolvedValue("expo_test");
    getWorkflowAdminKeyMock.mockResolvedValue("adminkey");
    readSigningKeyGateStateMock.mockResolvedValue({
      hasSigningKey: true,
      reason: null,
      localEdgeAdminKeyPresent: true,
      credentialState: "verified",
      credentialDetail: null,
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
});
