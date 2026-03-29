import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { TouchableOpacity } from "react-native";

import { SecretsSection } from "../screens/GitHubReposScreen/components/SecretsSection";

const mockListRepoSecretNames = jest.fn();
const mockGetExpoToken = jest.fn();
const mockGetWorkflowAdminKey = jest.fn();
const mockGetAndroidKeystoreExportAdminKey = jest.fn();
const mockGetEdgeAdminKey = jest.fn();

jest.mock("../infra/github/githubService", () => ({
  listRepoSecretNames: (...args: unknown[]) => mockListRepoSecretNames(...args),
  getExpoToken: (...args: unknown[]) => mockGetExpoToken(...args),
  getWorkflowAdminKey: (...args: unknown[]) => mockGetWorkflowAdminKey(...args),
  getAndroidKeystoreExportAdminKey: (...args: unknown[]) =>
    mockGetAndroidKeystoreExportAdminKey(...args),
  getLegacyEdgeAdminKey: (...args: unknown[]) => mockGetEdgeAdminKey(...args),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

function getRefreshButton(screen: ReturnType<typeof render>) {
  return screen.UNSAFE_getAllByType(TouchableOpacity)[0];
}

describe("GitHubReposScreen SecretsSection secret semantics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetExpoToken.mockResolvedValue("expo-local-token");
    mockGetWorkflowAdminKey.mockResolvedValue("workflow-local-key");
    mockGetAndroidKeystoreExportAdminKey.mockResolvedValue("keystore-local-key");
    mockGetEdgeAdminKey.mockResolvedValue("edge-local-key");
  });

  it("loads repo secret names only once automatically per repo context", async () => {
    mockListRepoSecretNames.mockResolvedValue(["EXPO_TOKEN", "SUPABASE_URL", "K1W1_EDGE_WORKFLOW_ADMIN_KEY"]);

    const screen = render(<SecretsSection activeRepo="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText("Secret-Namen bestätigt")).toBeTruthy();
    });

    await flushMicrotasks();

    expect(mockListRepoSecretNames).toHaveBeenCalledTimes(1);
    expect(mockListRepoSecretNames).toHaveBeenCalledWith("owner", "repo");
  });

  it("shows repo secret and local app value separately when the local Workflow Admin Key is missing", async () => {
    mockListRepoSecretNames.mockResolvedValue(["EXPO_TOKEN", "SUPABASE_URL", "K1W1_EDGE_WORKFLOW_ADMIN_KEY"]);
    mockGetWorkflowAdminKey.mockResolvedValue(null);

    const screen = render(<SecretsSection activeRepo="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText("Repo Secret ≠ Lokaler App-Wert")).toBeTruthy();
    });

    expect(screen.getAllByText("Repo Secret").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Lokaler App-Wert").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Lokaler Workflow Admin Key")).toBeTruthy();
    expect(screen.getByText("K1W1_EDGE_WORKFLOW_ADMIN_KEY")).toBeTruthy();
    expect(
      screen.getByText(/Workflow-\/Build-\/Artifact-Routen nutzen den lokalen Workflow Admin Key aus SecureStore/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/Repo-Secret-Namen koennen bestaetigt sein, aber fuer App-Dispatch fehlt noch: lokaler Workflow Admin Key/i),
    ).toBeTruthy();
  });

  it("supports manual refresh without reintroducing an automatic reload loop", async () => {
    mockListRepoSecretNames.mockResolvedValue(["EXPO_TOKEN", "SUPABASE_URL", "K1W1_EDGE_WORKFLOW_ADMIN_KEY"]);

    const screen = render(<SecretsSection activeRepo="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText("Secret-Namen bestätigt")).toBeTruthy();
    });

    expect(mockListRepoSecretNames).toHaveBeenCalledTimes(1);

    fireEvent.press(getRefreshButton(screen));

    await waitFor(() => {
      expect(mockListRepoSecretNames).toHaveBeenCalledTimes(2);
    });

    await flushMicrotasks();

    expect(mockListRepoSecretNames).toHaveBeenCalledTimes(2);
  });

  it("keeps the last verified repo-secret list visible when a refresh fails", async () => {
    mockListRepoSecretNames
      .mockResolvedValueOnce(["EXPO_TOKEN", "SUPABASE_URL", "K1W1_EDGE_WORKFLOW_ADMIN_KEY"])
      .mockRejectedValueOnce(new Error("403 forbidden"));

    const screen = render(<SecretsSection activeRepo="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText("Secret-Namen bestätigt")).toBeTruthy();
    });

    fireEvent.press(getRefreshButton(screen));

    await waitFor(() => {
      expect(screen.getByText("403 forbidden")).toBeTruthy();
    });

    expect(screen.getByText("Secret-Namen bestätigt")).toBeTruthy();
    expect(screen.getByText("Alle anzeigen (3)")).toBeTruthy();
    expect(screen.getAllByText("EXPO_TOKEN").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("SUPABASE_URL")).toBeTruthy();
  });

  it("invalidates stale repo-secret requests when the repo context changes", async () => {
    const repoA = createDeferred<string[]>();

    mockListRepoSecretNames.mockImplementation((owner: string, repo: string) => {
      if (owner === "owner" && repo === "repo-a") return repoA.promise;
      if (owner === "owner" && repo === "repo-b") return Promise.resolve(["EXPO_TOKEN", "SUPABASE_URL"]);
      throw new Error(`Unexpected repo ${owner}/${repo}`);
    });

    const screen = render(<SecretsSection activeRepo="owner/repo-a" />);

    screen.rerender(<SecretsSection activeRepo="owner/repo-b" />);

    await waitFor(() => {
      expect(screen.getByText("Secret-Namen bestätigt")).toBeTruthy();
    });

    await act(async () => {
      repoA.resolve(["EXPO_TOKEN", "SUPABASE_URL", "K1W1_EDGE_WORKFLOW_ADMIN_KEY"]);
      await repoA.promise;
    });
    await flushMicrotasks();

    expect(screen.getByText("Alle anzeigen (2)")).toBeTruthy();
    expect(screen.queryByText("Alle anzeigen (3)")).toBeNull();
    expect(mockListRepoSecretNames).toHaveBeenNthCalledWith(1, "owner", "repo-a");
    expect(mockListRepoSecretNames).toHaveBeenNthCalledWith(2, "owner", "repo-b");
  });


  it("shows legacy repo admin secret in its dedicated compat row", async () => {
    mockListRepoSecretNames.mockResolvedValue(["EXPO_TOKEN", "SUPABASE_URL", "K1W1_EDGE_ADMIN_KEY"]);
    mockGetEdgeAdminKey.mockResolvedValue("edge-local-key");

    const screen = render(<SecretsSection activeRepo="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText("Repo und lokal getrennt bestaetigt")).toBeTruthy();
    });

    expect(screen.getByText("K1W1_EDGE_ADMIN_KEY")).toBeTruthy();
    expect(screen.getByText("Lokaler Legacy Edge Admin Key (compat)")).toBeTruthy();
    expect(screen.getAllByText("bestätigt").length).toBeGreaterThanOrEqual(3);
  });

  it("shows both scoped repo/local keys as available when both exist", async () => {
    mockListRepoSecretNames.mockResolvedValue(["EXPO_TOKEN", "SUPABASE_URL", "K1W1_EDGE_WORKFLOW_ADMIN_KEY"]);
    mockGetWorkflowAdminKey.mockResolvedValue("workflow-local-key");

    const screen = render(<SecretsSection activeRepo="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText("Repo und lokal getrennt bestaetigt")).toBeTruthy();
    });

    expect(screen.getByText(/Die kritischen Werte sind getrennt sichtbar/i)).toBeTruthy();
    expect(screen.getAllByText("vorhanden").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("bestätigt").length).toBeGreaterThanOrEqual(3);
  });

  it("does not imply workflow readiness from a green repo secret alone when the local scoped key is missing", async () => {
    mockListRepoSecretNames.mockResolvedValue(["EXPO_TOKEN", "SUPABASE_URL", "K1W1_EDGE_WORKFLOW_ADMIN_KEY"]);
    mockGetWorkflowAdminKey.mockResolvedValue("");

    const screen = render(<SecretsSection activeRepo="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText("Repo Secret ≠ Lokaler App-Wert")).toBeTruthy();
    });

    expect(screen.getByText("Secret-Namen bestätigt")).toBeTruthy();
    expect(
      screen.getByText(/Repo-Secret-Namen und lokaler App-Wert sind getrennte Readiness-Signale/i),
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
