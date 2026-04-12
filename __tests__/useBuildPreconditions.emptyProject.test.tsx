jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
}));

import React from "react";
import { Text } from "react-native";
import { render, waitFor } from "@testing-library/react-native";

import { useBuildPreconditions } from "../screens/EnhancedBuildScreen/hooks/useBuildPreconditions";

jest.mock("../infra/github/githubService", () => ({
  getGitHubToken: jest.fn(async () => "gh"),
  getExpoToken: jest.fn(async () => "expo"),
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

jest.mock("../screens/EnhancedBuildScreen/hooks/signingKeyGate", () => ({
  readSigningKeyGateState: jest.fn(async () => ({ hasSigningKey: true, reason: null })),
}));

jest.mock("../screens/EnhancedBuildScreen/hooks/buildReadinessState", () => ({
  readBuildReadinessState: jest.fn(async () => ({
    hasDiagOk: true,
    hasCiLiteOk: true,
    diagnosticState: "verified",
    diagnosticReason: null,
    ciLiteReason: null,
    ciLiteState: "verified",
    ciLiteStale: false,
  })),
}));

jest.mock("../lib/repoSyncOrchestration", () => ({
  getRepoSyncState: jest.fn(async () => "in_sync"),
}));

function Harness() {
  const state = useBuildPreconditions("preview", "owner/repo", "main", {
    id: "p1",
    files: [],
  });

  return (
    <>
      <Text testID="hasProjectFiles">{String(state.hasProjectFiles)}</Text>
      <Text testID="projectFilesReason">{state.projectFilesReason ?? ""}</Text>
      <Text testID="repoSyncState">{state.repoSyncState}</Text>
    </>
  );
}

describe("useBuildPreconditions empty project guard", () => {
  it("marks an empty project as not build-ready before repo sync becomes relevant", async () => {
    const { getRepoSyncState } = jest.requireMock("../lib/repoSyncOrchestration") as {
      getRepoSyncState: jest.Mock;
    };
    const screen = render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId("hasProjectFiles").props.children).toBe("false");
      expect(String(screen.getByTestId("projectFilesReason").props.children)).toMatch(/Projekt ist leer/i);
      expect(screen.getByTestId("repoSyncState").props.children).toBe("unknown");
    });
    expect(getRepoSyncState).not.toHaveBeenCalled();
  });

  it("fails closed when a refresh throws after an earlier green snapshot", async () => {
    const { readBuildReadinessState } = jest.requireMock("../screens/EnhancedBuildScreen/hooks/buildReadinessState");
    readBuildReadinessState
      .mockResolvedValueOnce({
        hasDiagOk: true,
        hasCiLiteOk: true,
        diagnosticState: "verified",
        diagnosticReason: null,
        ciLiteReason: null,
        ciLiteState: "verified",
        ciLiteStale: false,
      })
      .mockRejectedValue(new Error("boom"));

    function HarnessFailure() {
      const state = useBuildPreconditions("preview", "owner/repo", "main", {
        id: "p1",
        files: [{ path: "App.tsx", content: "export default null" }],
      });

      React.useEffect(() => {
        state.refreshPreconditions().catch(() => {});
      }, [state.refreshPreconditions]);

      return (
        <>
          <Text testID="hasDiagOk">{String(state.hasDiagOk)}</Text>
          <Text testID="diagnosticReason">{state.diagnosticReason ?? ""}</Text>
          <Text testID="repoSyncState">{state.repoSyncState}</Text>
        </>
      );
    }

    const screen = render(<HarnessFailure />);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await waitFor(() => {
      expect(screen.getByTestId("hasDiagOk").props.children).toBe("false");
      expect(String(screen.getByTestId("diagnosticReason").props.children)).toMatch(/nicht frisch geladen/i);
      expect(screen.getByTestId("repoSyncState").props.children).toBe("unknown");
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "[useBuildPreconditions] refresh failed; applying fail-closed defaults",
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

});
