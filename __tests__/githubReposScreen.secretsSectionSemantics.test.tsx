import React from "react";
import { render, waitFor } from "@testing-library/react-native";

import { SecretsSection } from "../screens/GitHubReposScreen/components/SecretsSection";

const mockListRepoSecretNames = jest.fn();

jest.mock("../infra/github/githubService", () => ({
  listRepoSecretNames: (...args: unknown[]) => mockListRepoSecretNames(...args),
}));

describe("GitHubReposScreen SecretsSection secret semantics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders a confirmed green state when the secret list confirms the required secrets", async () => {
    mockListRepoSecretNames.mockResolvedValue(["EXPO_TOKEN", "SUPABASE_URL"]);

    const screen = render(<SecretsSection activeRepo="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText("Secret-Namen bestätigt")).toBeTruthy();
    });

    expect(screen.getByText("EXPO_TOKEN")).toBeTruthy();
    expect(screen.getAllByText("bestätigt").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Alle anzeigen (2)")).toBeTruthy();
  });

  it("renders missing for a successful list fetch without the required secret", async () => {
    mockListRepoSecretNames.mockResolvedValue(["SUPABASE_URL"]);

    const screen = render(<SecretsSection activeRepo="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText("Bestätigt, aber unvollständig")).toBeTruthy();
    });

    expect(screen.getByText("EXPO_TOKEN")).toBeTruthy();
    expect(screen.getAllByText("fehlt").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/GitHub hat die Repo-Secret-Namensliste bestätigt, aber mindestens ein Pflicht-Secret fehlt/i),
    ).toBeTruthy();
  });

  it("renders auth_error warning semantics instead of missing when secret access returns 401 or 403", async () => {
    mockListRepoSecretNames.mockRejectedValue(new Error("403 Forbidden"));

    const screen = render(<SecretsSection activeRepo="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText("Zugriff auf Repo-Secrets blockiert")).toBeTruthy();
    });

    expect(screen.getAllByText("auth-blockiert").length).toBeGreaterThan(0);
    expect(screen.queryByText("Bestätigt, aber unvollständig")).toBeNull();
    expect(screen.queryByText("fehlt")).toBeNull();
  });

  it("renders unknown instead of missing for generic fetch errors", async () => {
    mockListRepoSecretNames.mockRejectedValue(new Error("temporary network timeout"));

    const screen = render(<SecretsSection activeRepo="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText("Repo-Secret-Prüfung aktuell unklar")).toBeTruthy();
    });

    expect(screen.getAllByText("unklar").length).toBeGreaterThan(0);
    expect(screen.queryByText("fehlt")).toBeNull();
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
