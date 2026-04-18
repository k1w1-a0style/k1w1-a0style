import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import ConnectionsScreen from "../screens/ConnectionsScreen";

const mockUseConnectionsScreen = jest.fn();
const mockUseDebugEntries = jest.fn();
const mockNavigate = jest.fn();

jest.mock("../screens/ConnectionsScreen/hooks/useConnectionsScreen", () => ({
  useConnectionsScreen: () => mockUseConnectionsScreen(),
}));

jest.mock("../hooks/useDebugEntries", () => ({
  useDebugEntries: () => mockUseDebugEntries(),
}));

jest.mock("../lib/debugOverlay", () => ({
  clearDebugEntries: jest.fn(),
}));

jest.mock("../screens/ConnectionsScreen/components/TokensCard", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    TokensCard: () => React.createElement(Text, null, "TokensCard"),
  };
});

jest.mock("../screens/ConnectionsScreen/components/SupabaseCard", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    SupabaseCard: () => React.createElement(Text, null, "SupabaseCard"),
  };
});

jest.mock("../screens/ConnectionsScreen/components/EasCard", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    EasCard: () => React.createElement(Text, null, "EasCard"),
  };
});

describe("Connections → Build/Diagnostic flow regression", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDebugEntries.mockReturnValue([]);
    mockUseConnectionsScreen.mockReturnValue({
      navigation: { navigate: mockNavigate },
      ui: {
        busy: false,
        hydrated: true,
        isEasInitRunning: false,
        isTestingEas: false,
      },
      connection: {
        githubOk: false,
        githubUser: "demo-user",
        githubScopes: "repo,workflow",
        supabaseOk: false,
        supabaseRef: "demo",
        expoOk: false,
        expoUser: "expo-user",
        easOk: false,
        status: {
          gh: false,
          ex: false,
          edge: false,
          sbUrl: false,
          sbAnon: false,
          linked: false,
          eas: false,
        },
        repoLine: "owner/repo (main)",
        selectionSource: "project",
      },
      tokens: {
        githubToken: "ghp_test",
        setGithubToken: jest.fn(),
        expoToken: "expo_test",
        setExpoToken: jest.fn(),
        workflowAdminKey: "workflow-admin-key",
        setWorkflowAdminKey: jest.fn(),
        androidKeystoreExportAdminKey: "keystore-admin-key",
        setAndroidKeystoreExportAdminKey: jest.fn(),
      },
      visibility: {
        showGitHub: false,
        setShowGitHub: jest.fn(),
        showExpo: false,
        setShowExpo: jest.fn(),
        showWorkflowAdmin: false,
        setShowWorkflowAdmin: jest.fn(),
        showKeystoreAdmin: false,
        setShowKeystoreAdmin: jest.fn(),
        showSupabaseAnon: false,
        setShowSupabaseAnon: jest.fn(),
      },
      supabase: {
        supabaseRaw: "https://demo.supabase.co",
        setSupabaseRaw: jest.fn(),
        supabaseUrl: "https://demo.supabase.co",
        setSupabaseUrl: jest.fn(),
        supabaseAnonKey: "anon-key",
        setSupabaseAnonKey: jest.fn(),
      },
      eas: {
        easProjectId: "11111111-1111-1111-1111-111111111111",
        setEasProjectId: jest.fn(),
        easState: "missing",
        easLastVerifiedAt: null,
        testEas: jest.fn(async () => {}),
        onLinkExisting: jest.fn(async () => {}),
        onCreateAndLink: jest.fn(async () => {}),
      },
      actions: {
        saveAll: jest.fn(async () => {}),
        testGitHub: jest.fn(async () => {}),
        testSupabase: jest.fn(async () => {}),
        testExpo: jest.fn(async () => {}),
      },
    });
  });

  it("navigates from Connections shortcuts into Build and Diagnostic", () => {
    const screen = render(<ConnectionsScreen />);

    fireEvent.press(screen.getByTestId("connections-status-go-build-button"));
    fireEvent.press(screen.getByTestId("connections-status-go-diagnostic-button"));

    expect(mockNavigate).toHaveBeenCalledWith("EnhancedBuild");
    expect(mockNavigate).toHaveBeenCalledWith("Diagnostic");
  });
});