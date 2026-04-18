import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import { StatusCard } from "../screens/ConnectionsScreen/components/StatusCard";
import { styles as parentStyles } from "../screens/ConnectionsScreen/styles";

describe("Connections StatusCard navigation actions", () => {
  it("routes the three primary status shortcuts correctly", () => {
    const onNavigateRepos = jest.fn();
    const onNavigateBuild = jest.fn();
    const onNavigateDiagnostic = jest.fn();

    const screen = render(
      <StatusCard
        styles={parentStyles}
        busy={false}
        status={{ gh: false, ex: false, edge: false, sbUrl: false, sbAnon: false, linked: false, eas: false }}
        repoLine="owner/repo (main)"
        selectionSource="project"
        supabaseUrl="https://demo.supabase.co"
        supabaseRef="demo"
        easProjectId="11111111-1111-1111-1111-111111111111"
        easLastVerifiedAt="2026-04-18T00:00:00.000Z"
        githubOk={false}
        githubUser="demo-user"
        githubScopes="repo,workflow"
        supabaseOk={false}
        expoOk={false}
        expoUser="expo-user"
        easOk={false}
        easInitRunning={false}
        easState="missing"
        onNavigateRepos={onNavigateRepos}
        onNavigateDiagnostic={onNavigateDiagnostic}
        onNavigateBuild={onNavigateBuild}
      />,
    );

    fireEvent.press(screen.getByTestId("connections-status-go-repos-button"));
    fireEvent.press(screen.getByTestId("connections-status-go-build-button"));
    fireEvent.press(screen.getByTestId("connections-status-go-diagnostic-button"));

    expect(onNavigateRepos).toHaveBeenCalledTimes(1);
    expect(onNavigateBuild).toHaveBeenCalledTimes(1);
    expect(onNavigateDiagnostic).toHaveBeenCalledTimes(1);
  });
});