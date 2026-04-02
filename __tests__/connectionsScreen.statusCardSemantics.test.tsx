import React from "react";
import { render } from "@testing-library/react-native";
import { Animated } from "react-native";

import { StatusCard } from "../screens/ConnectionsScreen/components/StatusCard";
import { styles as screenStyles } from "../screens/ConnectionsScreen/styles";

const baseProps = {
  styles: screenStyles,
  busy: false,
  status: {
    gh: true,
    ex: true,
    edge: false,
    sbUrl: true,
    sbAnon: true,
    linked: true,
    eas: true,
  },
  repoLine: "owner/repo (main)",
  selectionSource: "project" as const,
  supabaseUrl: "https://demo.supabase.co",
  supabaseRef: "demo",
  easProjectId: "11111111-1111-1111-1111-111111111111",
  githubOk: true,
  githubUser: "demo",
  githubScopes: "repo,workflow",
  supabaseOk: true,
  expoOk: true,
  expoUser: "expo-user",
  onNavigateRepos: jest.fn(),
  onNavigateDiagnostic: jest.fn(),
  onNavigateBuild: jest.fn(),
};

function makeAnimation(): Animated.CompositeAnimation {
  return {
    start: (cb?: Animated.EndCallback) => cb?.({ finished: true }),
    stop: jest.fn(),
    reset: jest.fn(),
  } as Animated.CompositeAnimation;
}

describe("ConnectionsScreen StatusCard semantics", () => {
  beforeAll(() => {
    jest.spyOn(Animated, "timing").mockImplementation(() => makeAnimation());
    jest.spyOn(Animated, "sequence").mockImplementation(() => makeAnimation());
    jest.spyOn(Animated, "loop").mockImplementation(() => makeAnimation());
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("renders auth/permission EAS state as access problem instead of missing", () => {
    const { queryByText, getByText } = render(
      <StatusCard
        {...baseProps}
        easOk={false}
        easState="auth_error"
      />,
    );

    expect(getByText("ZUGRIFF")).toBeTruthy();
    expect(getByText(/konnte sie mit diesem login nicht bestaetigen/i)).toBeTruthy();
    expect(queryByText("FEHLT")).toBeNull();
  });

  it("renders unknown EAS verification as unclear instead of missing", () => {
    const { queryByText, getByText } = render(
      <StatusCard
        {...baseProps}
        easOk={false}
        easState="unknown"
      />,
    );

    expect(getByText("UNKLAR")).toBeTruthy();
    expect(getByText(/nicht sicher verifizierbar/i)).toBeTruthy();
    expect(queryByText("FEHLT")).toBeNull();
  });
});
