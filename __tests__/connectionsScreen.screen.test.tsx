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

jest.mock("../screens/ConnectionsScreen/components/StatusCard", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    StatusCard: ({ repoLine }: { repoLine: string }) => React.createElement(Text, null, repoLine),
    resolveEasVerificationPresentation: () => ({ stateLabel: "VERIFIED" }),
  };
});

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

describe("ConnectionsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDebugEntries.mockReturnValue([]);
    mockUseConnectionsScreen.mockReturnValue({
      navigation: { navigate: mockNavigate },
      busy: false,
      hydrated: true,
      isEasInitRunning: false,
      status: {
        gh: true,
        ex: true,
        edge: true,
        sbUrl: true,
        sbAnon: true,
        linked: true,
        eas: true,
      },
      repoLine: "owner/repo (main)",
      selectionSource: "project",
      supabaseUrl: "https://demo.supabase.co",
      easProjectId: "11111111-1111-1111-1111-111111111111",
      easLastVerifiedAt: "2026-03-23T00:00:00.000Z",
      easState: "verified",
      githubOk: true,
      githubUser: "demo-user",
      githubScopes: "repo,workflow",
      supabaseOk: true,
      supabaseRef: "demo",
      expoOk: true,
      expoUser: "expo-user",
      easOk: true,
      githubToken: "ghp_test",
      setGithubToken: jest.fn(),
      expoToken: "expo_test",
      setExpoToken: jest.fn(),
      edgeAdminKey: "edge-admin-key",
      setEdgeAdminKey: jest.fn(),
      showGitHub: false,
      setShowGitHub: jest.fn(),
      showExpo: false,
      setShowExpo: jest.fn(),
      showEdge: false,
      setShowEdge: jest.fn(),
      showSupabaseAnon: false,
      setShowSupabaseAnon: jest.fn(),
      supabaseRaw: "https://demo.supabase.co",
      setSupabaseRaw: jest.fn(),
      setSupabaseUrl: jest.fn(),
      supabaseAnonKey: "anon-key",
      setSupabaseAnonKey: jest.fn(),
      setEasProjectId: jest.fn(),
      onLinkExisting: jest.fn(async () => {}),
      onCreateAndLink: jest.fn(async () => {}),
      testEas: jest.fn(async () => {}),
      isTestingEas: false,
      saveAll: jest.fn(async () => {}),
      testGitHub: jest.fn(async () => {}),
      testSupabase: jest.fn(async () => {}),
      testExpo: jest.fn(async () => {}),
    });
  });

  it("renders the selected repo status and sync summary", () => {
    const screen = render(<ConnectionsScreen />);

    expect(screen.getByText("Verbindungen")).toBeTruthy();
    expect(screen.getByText(/owner\/repo \(main\)/)).toBeTruthy();
    expect(screen.getByText("TokensCard")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Sync Summary"));

    expect(screen.getAllByText("Sync Summary").length).toBeGreaterThan(0);
    expect(screen.getByText("Repo: owner/repo (main)")).toBeTruthy();
    expect(screen.getByText("GitHub Scopes: repo,workflow")).toBeTruthy();
  });
});
