import React from "react";
import { render, waitFor } from "@testing-library/react-native";

import { SecretsSection } from "../screens/GitHubReposScreen/components/SecretsSection";

const mockListRepoSecretNames = jest.fn();
const mockGetExpoToken = jest.fn();
const mockGetEdgeAdminKey = jest.fn();

jest.mock("../infra/github/githubService", () => ({
  listRepoSecretNames: (...args: unknown[]) => mockListRepoSecretNames(...args),
  getExpoToken: (...args: unknown[]) => mockGetExpoToken(...args),
  getEdgeAdminKey: (...args: unknown[]) => mockGetEdgeAdminKey(...args),
}));

describe("GitHubReposScreen SecretsSection secret semantics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetExpoToken.mockResolvedValue("expo-local-token");
    mockGetEdgeAdminKey.mockResolvedValue("edge-local-key");
  });

  it("shows repo secret and local app value separately when the local Edge Admin Key is missing", async () => {
    mockListRepoSecretNames.mockResolvedValue(["EXPO_TOKEN", "SUPABASE_URL", "K1W1_EDGE_ADMIN_KEY"]);
    mockGetEdgeAdminKey.mockResolvedValue(null);

    const screen = render(<SecretsSection activeRepo="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText("Repo Secret ≠ Lokaler App-Wert")).toBeTruthy();
    });

    expect(screen.getAllByText("Repo Secret").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Lokaler App-Wert").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("K1W1_EDGE_ADMIN_KEY").length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText(/CI Lite \/ Edge Dispatch nutzt den lokalen Edge Admin Key aus SecureStore/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/Repo-Secret-Namen koennen bestaetigt sein, aber fuer App-Dispatch fehlt noch: Edge Admin Key lokal/i),
    ).toBeTruthy();
  });

  it("shows both repo and local Edge Admin Key as available when both exist", async () => {
    mockListRepoSecretNames.mockResolvedValue(["EXPO_TOKEN", "SUPABASE_URL", "K1W1_EDGE_ADMIN_KEY"]);
    mockGetEdgeAdminKey.mockResolvedValue("edge-local-key");

    const screen = render(<SecretsSection activeRepo="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText("Repo und lokal getrennt bestaetigt")).toBeTruthy();
    });

    expect(screen.getByText(/Die kritischen Werte sind getrennt sichtbar/i)).toBeTruthy();
    expect(screen.getAllByText("vorhanden").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("bestätigt").length).toBeGreaterThanOrEqual(3);
  });

  it("does not imply CI Lite readiness from a green repo secret alone when the local dispatch key is missing", async () => {
    mockListRepoSecretNames.mockResolvedValue(["EXPO_TOKEN", "SUPABASE_URL", "K1W1_EDGE_ADMIN_KEY"]);
    mockGetEdgeAdminKey.mockResolvedValue("");

    const screen = render(<SecretsSection activeRepo="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText("Repo Secret ≠ Lokaler App-Wert")).toBeTruthy();
    });

    expect(screen.getByText("Secret-Namen bestätigt")).toBeTruthy();
    expect(
      screen.getByText(/Ein gruener Repo-Secret-Name allein macht diesen Dispatch nicht bereit/i),
    ).toBeTruthy();
    expect(screen.queryByText(/CI Lite Auth bereit/i)).toBeNull();
  });

  it("separates EXPO_TOKEN repo secret from the local Expo runtime value", async () => {
    mockListRepoSecretNames.mockResolvedValue(["EXPO_TOKEN", "SUPABASE_URL"]);
    mockGetExpoToken.mockResolvedValue(null);

    const screen = render(<SecretsSection activeRepo="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText("Repo Secret ≠ Lokaler App-Wert")).toBeTruthy();
    });

    expect(screen.getAllByText("EXPO_TOKEN").length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText(/Repo Secret vorhanden ≠ lokaler Expo-Token vorhanden/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/fuer App-Dispatch fehlt noch: Expo-Token lokal/i),
    ).toBeTruthy();
  });

  it("keeps the verified secret display correct when optional secrets stay absent", async () => {
    mockListRepoSecretNames.mockResolvedValue(["EXPO_TOKEN", "SUPABASE_URL"]);

    const screen = render(<SecretsSection activeRepo="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText("Secret-Namen bestätigt")).toBeTruthy();
    });

    expect(screen.getByText("SUPABASE_URL")).toBeTruthy();
    expect(screen.getAllByText("bestätigt").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("SUPABASE_SERVICE_ROLE_KEY")).toBeTruthy();
  });
});
