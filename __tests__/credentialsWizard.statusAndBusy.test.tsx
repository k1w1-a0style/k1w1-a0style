import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useCredentialsWizardScreen } from "../screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen";

const mockInvokeEdgeJson = jest.fn();
const mockUseProject = jest.fn();
const mockShowToast = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));

jest.mock("../contexts/ProjectContext", () => ({
  useProject: () => mockUseProject(),
}));

jest.mock("../lib/supabase", () => ({
  ensureSupabaseClient: jest.fn(async () => ({ supabaseUrl: "https://example.supabase.co" })),
}));

jest.mock("../infra/github/githubService", () => ({
  getEdgeAdminKey: jest.fn(async () => "admin-key-12345678901234567890"),
  saveEdgeAdminKey: jest.fn(async () => undefined),
}));

jest.mock("../components/diagnostics/useInlineToast", () => ({
  useInlineToast: () => ({
    show: mockShowToast,
  }),
}));

jest.mock("../screens/CredentialsWizardScreen/hooks/credentialHelpers", () => {
  const actual = jest.requireActual("../screens/CredentialsWizardScreen/hooks/credentialHelpers");
  return {
    ...actual,
    invokeEdgeJson: (...args: unknown[]) => mockInvokeEdgeJson(...args),
  };
});

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("CredentialsWizard status/auth and busy guards", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseProject.mockReturnValue({
      projectData: {
        id: "project-1",
        linkedRepo: "owner/repo",
        linkedBranch: "main",
        preferredBuildProfile: "preview",
      },
      setPreferredBuildProfile: jest.fn(),
    });
  });

  it("keeps status unknown when refreshStatus gets HTTP 401/403", async () => {
    mockInvokeEdgeJson.mockResolvedValueOnce({
      ok: false,
      error: "HTTP 401 Unauthorized: invalid admin key",
      debug: {
        url: "https://example.supabase.co/functions/v1/android-keystore-status",
        status: 401,
        statusText: "Unauthorized",
        bodyText: "invalid admin key",
      },
    });

    const { result } = renderHook(() => useCredentialsWizardScreen());

    await waitFor(() => expect(result.current.canRun).toBe(true));

    await act(async () => {
      await result.current.refreshStatus("preview");
    });

    expect(result.current.statusByMode.preview).toBeNull();
    expect(result.current.lastError).toContain("HTTP 401");
  });

  it("blocks refreshAll and generate while refreshStatus is already running", async () => {
    const firstRequest = deferred<{
      ok: true;
      data: { exists: boolean };
      debug: { url: string; status: number; statusText: string; bodyText: string };
    }>();
    mockInvokeEdgeJson.mockImplementationOnce(() => firstRequest.promise);

    const { result } = renderHook(() => useCredentialsWizardScreen());

    await waitFor(() => expect(result.current.canRun).toBe(true));

    act(() => {
      void result.current.refreshStatus("dev");
    });

    await act(async () => {
      await flushPromises();
    });

    act(() => {
      void result.current.refreshAll();
      void result.current.generate("dev");
    });

    expect(mockInvokeEdgeJson).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstRequest.resolve({
        ok: true,
        data: { exists: true },
        debug: {
          url: "https://example.supabase.co/functions/v1/android-keystore-status",
          status: 200,
          statusText: "OK",
          bodyText: "{\"exists\":true}",
        },
      });
      await flushPromises();
    });

    expect(result.current.statusByMode.dev).toEqual({ exists: true });
  });
});
