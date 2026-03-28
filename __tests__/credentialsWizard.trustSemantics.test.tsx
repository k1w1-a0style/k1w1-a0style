import React from "react";
import { Alert } from "react-native";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react-native";

import { KeystoreStatusSection } from "../screens/CredentialsWizardScreen/components/KeystoreStatusSection";
import { useCredentialsWizardScreen } from "../screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen";
import {
  formatWizardBusyLabel,
  resolveWizardStatusPresentation,
  toGeneratedPendingStatus,
  toWizardErrorStatus,
  toWizardStatusResult,
} from "../screens/CredentialsWizardScreen/statusContract";
import type { StatusResult } from "../screens/CredentialsWizardScreen/types";

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(),
}));

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
}));

const mockGetItem = jest.fn(async (_key: string) => null);
const mockSetItem = jest.fn(async (_key: string, _value: string) => undefined);

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));

const mockToastShow = jest.fn();

jest.mock("../components/diagnostics/useInlineToast", () => ({
  useInlineToast: () => ({ message: null, anim: null, show: mockToastShow }),
}));

jest.mock("../lib/supabase", () => ({
  ensureSupabaseClient: jest.fn(async () => ({
    supabaseUrl: "https://example.supabase.co",
    auth: {
      getSession: async () => ({ data: { session: { access_token: "wizard-user-jwt-123" } } }),
    },
  })),
}));

let currentStoredAdminKey = "admin-key-12345678901234567890";
const mockGetAndroidKeystoreExportAdminKey = jest.fn(async () => currentStoredAdminKey);
const mockGetEdgeAdminKey = jest.fn(async () => null);
const mockSaveAndroidKeystoreExportAdminKey = jest.fn(async (nextKey: string) => {
  currentStoredAdminKey = nextKey;
});

jest.mock("../infra/github/githubService", () => ({
  getAndroidKeystoreExportAdminKey: () => mockGetAndroidKeystoreExportAdminKey(),
  getLegacyEdgeAdminKey: () => mockGetEdgeAdminKey(),
  saveAndroidKeystoreExportAdminKey: (key: string) => mockSaveAndroidKeystoreExportAdminKey(key),
}));

const mockSetPreferredBuildProfile = jest.fn(async () => undefined);

jest.mock("../contexts/ProjectContext", () => ({
  useProject: () => ({
    projectData: {
      id: "project-1",
      linkedRepo: "owner/repo",
      linkedBranch: "main",
      preferredBuildProfile: "development",
    },
    setPreferredBuildProfile: mockSetPreferredBuildProfile,
  }),
}));

describe("CredentialsWizard trust semantics", () => {
  const originalFetch = global.fetch;
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

  afterEach(() => {
    global.fetch = originalFetch;
    currentStoredAdminKey = "admin-key-12345678901234567890";
    jest.clearAllMocks();
  });

  afterAll(() => {
    alertSpy.mockRestore();
  });

  it("does not classify auth/permission or temporary errors as missing", () => {
    const authState = toWizardErrorStatus({ previous: null, statusCode: 403, error: "Forbidden", detail: "Lokaler Android Keystore Export Admin Key ist lokal vorhanden und wurde fuer den geschuetzten Keystore-Edge-Request verwendet, aber vom Edge-Server abgelehnt (401/403 bzw. invalid admin)." });
    const temporaryState = toWizardErrorStatus({ previous: null, error: new Error("temporary network timeout") });

    expect(authState.credentialState).toBe("auth_error");
    expect(temporaryState.credentialState).toBe("unknown");

    expect(
      resolveWizardStatusPresentation({ status: authState, mode: "dev", busy: null }).treatsAsMissing,
    ).toBe(false);
    expect(
      resolveWizardStatusPresentation({ status: temporaryState, mode: "dev", busy: null }).treatsAsMissing,
    ).toBe(false);
  });

  it("keeps a successful generate step pending until verification really succeeds", () => {
    const pending = toGeneratedPendingStatus(null);
    const presentation = resolveWizardStatusPresentation({ status: pending, mode: "preview", busy: null });

    expect(pending.credentialState).toBe("generated_pending_verification");
    expect(presentation.treatsAsVerified).toBe(false);
    expect(presentation.text).toMatch(/offen/i);
  });

  it("promotes generated pending to verified after a successful re-check", () => {
    const pending = toGeneratedPendingStatus(null);
    const verified = toWizardStatusResult({
      exists: true,
      record: { alias: "android-preview", mode: "preview" },
    });

    expect(pending.credentialState).toBe("generated_pending_verification");
    expect(verified.credentialState).toBe("verified");
    expect(resolveWizardStatusPresentation({ status: verified, mode: "preview", busy: null }).treatsAsVerified).toBe(true);
  });

  it("renders unknown/auth_error/generated_pending without hard missing or false success copy", () => {
    const noop = () => undefined;
    render(
      <KeystoreStatusSection
        modes={[
          { id: "dev", label: "Dev", hint: "" },
          { id: "preview", label: "Preview", hint: "" },
          { id: "production", label: "Production", hint: "" },
        ]}
        statusByMode={{
          dev: toWizardErrorStatus({ previous: null, error: new Error("temporary network timeout") }),
          preview: toWizardErrorStatus({ previous: null, statusCode: 403, error: "Forbidden", detail: "Lokaler Android Keystore Export Admin Key ist lokal vorhanden und wurde fuer den geschuetzten Keystore-Edge-Request verwendet, aber vom Edge-Server abgelehnt (401/403 bzw. invalid admin)." }),
          production: toGeneratedPendingStatus(null),
        }}
        selectedMode="dev"
        setSelectedMode={noop}
        canRun
        busy={null}
        metaForStatus={(status, mode) => {
          const presentation = resolveWizardStatusPresentation({ status, mode, busy: null });
          return {
            icon: presentation.icon,
            text: presentation.text,
            color: "#fff",
            detail: presentation.detail,
            state: presentation.state,
            requiresManualRecheck: presentation.requiresManualRecheck,
            treatsAsMissing: presentation.treatsAsMissing,
            treatsAsVerified: presentation.treatsAsVerified,
          };
        }}
        normalizeModeForUi={(mode) => {
          if (mode === "development") return "dev";
          if (mode === "preview") return "preview";
          if (mode === "production") return "production";
          return undefined;
        }}
        pickStorageBucket={() => undefined}
        pickStoragePath={() => undefined}
        pickUpdatedAt={() => undefined}
        refreshStatus={noop}
        generate={noop}
      />,
    );

    expect(screen.getByText("lokaler Key abgelehnt")).toBeTruthy();
    expect(screen.getByText("generiert, noch offen")).toBeTruthy();
    expect(screen.queryByText(/^verifiziert$/i)).toBeNull();
    expect(screen.queryByText(/^fehlt$/i)).toBeNull();
    expect(screen.getAllByText(/Noch kein hart verifizierter Erfolg/i).length).toBeGreaterThan(0);
  });

  it("allows whitespace-only input to delete the local Android Keystore Export Admin Key", async () => {
    currentStoredAdminKey = "   ";
    const { result } = renderHook(() => useCredentialsWizardScreen());

    await waitFor(() => expect(result.current.adminKeyLoaded).toBe(true));
    expect(result.current.adminKey).toBe("   ");

    await act(async () => {
      await result.current.onSaveAdminKey();
    });

    expect(mockSaveAndroidKeystoreExportAdminKey).toHaveBeenCalledWith("");
    expect(mockGetAndroidKeystoreExportAdminKey).toHaveBeenCalled();
    expect(mockToastShow).toHaveBeenCalledWith("Android Keystore Export Admin Key gelöscht und neu geladen");
    expect(alertSpy).not.toHaveBeenCalled();
    expect(result.current.adminKey).toBe("");
  });

  it("does not persist a non-empty but formally invalid local Android Keystore Export Admin Key", async () => {
    currentStoredAdminKey = "  short key  ";
    const { result } = renderHook(() => useCredentialsWizardScreen());

    await waitFor(() => expect(result.current.adminKeyLoaded).toBe(true));
    expect(result.current.adminKey).toBe("  short key  ");

    await act(async () => {
      await result.current.onSaveAdminKey();
    });

    expect(mockSaveAndroidKeystoreExportAdminKey).not.toHaveBeenCalled();
    expect(mockGetAndroidKeystoreExportAdminKey).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      "Admin-Key wirkt ungültig",
      "Bitte nur einen formal gültigen lokalen Android Keystore Export Admin Key ohne Leerzeichen speichern.",
    );
    expect(mockToastShow).not.toHaveBeenCalled();
    expect(currentStoredAdminKey).toBe("  short key  ");
  });

  it("persists a formally valid local Android Keystore Export Admin Key as before", async () => {
    currentStoredAdminKey = "  edge-admin-key-abcdefghijklmnopqrstuvwxyz123456  ";
    const { result } = renderHook(() => useCredentialsWizardScreen());

    await waitFor(() => expect(result.current.adminKeyLoaded).toBe(true));
    expect(result.current.adminKey).toBe("  edge-admin-key-abcdefghijklmnopqrstuvwxyz123456  ");

    await act(async () => {
      await result.current.onSaveAdminKey();
    });

    expect(mockSaveAndroidKeystoreExportAdminKey).toHaveBeenCalledWith("edge-admin-key-abcdefghijklmnopqrstuvwxyz123456");
    expect(mockGetAndroidKeystoreExportAdminKey).toHaveBeenCalled();
    expect(mockToastShow).toHaveBeenCalledWith("Android Keystore Export Admin Key gespeichert und neu geladen");
    expect(alertSpy).not.toHaveBeenCalled();
    expect(result.current.adminKey).toBe("edge-admin-key-abcdefghijklmnopqrstuvwxyz123456");
    expect(currentStoredAdminKey).toBe("edge-admin-key-abcdefghijklmnopqrstuvwxyz123456");
  });

  it("blocks parallel contradictory wizard actions with the shared busy guard", async () => {
    let resolveGenerate: ((value: Response) => void) | null = null;
    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveGenerate = resolve;
        }),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useCredentialsWizardScreen());

    await waitFor(() => expect(result.current.canRun).toBe(true));

    await act(async () => {
      void result.current.generate("dev");
      await Promise.resolve();
      void result.current.refreshStatus("dev");
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.formatBusyLabel).toBe(formatWizardBusyLabel("generate:dev"));

    await act(async () => {
      resolveGenerate?.(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      await Promise.resolve();
    });
  });

  it("does not let a fresh auth failure look like an actually verified current state", () => {
    const previouslyVerified = toWizardStatusResult({
      exists: true,
      record: { alias: "android-dev", mode: "development" },
    });
    const freshAuthError = toWizardErrorStatus({
      previous: previouslyVerified,
      statusCode: 401,
      error: "Unauthorized: missing or invalid admin key",
      detail: "Lokaler Android Keystore Export Admin Key ist lokal vorhanden und wurde fuer den geschuetzten Keystore-Edge-Request verwendet, aber vom Edge-Server abgelehnt (401/403 bzw. invalid admin).",
    });
    const presentation = resolveWizardStatusPresentation({
      status: freshAuthError,
      mode: "dev",
      busy: null,
    });

    expect(freshAuthError.exists).toBe(true);
    expect(freshAuthError.credentialState).toBe("auth_error");
    expect(presentation.treatsAsVerified).toBe(false);
    expect(presentation.text).toBe("lokaler Key abgelehnt");
  });

  it("keeps real verified and missing states working cleanly", () => {
    const verified: StatusResult = {
      exists: true,
      record: { alias: "android-dev", mode: "development", updatedAt: "2026-03-19T00:00:00.000Z" },
    };
    const missing: StatusResult = { exists: false };

    expect(toWizardStatusResult(verified).credentialState).toBe("verified");
    expect(toWizardStatusResult(missing).credentialState).toBe("missing");
    expect(resolveWizardStatusPresentation({ status: verified, mode: "dev", busy: null }).treatsAsVerified).toBe(true);
    expect(resolveWizardStatusPresentation({ status: missing, mode: "dev", busy: null }).treatsAsMissing).toBe(true);
  });
});
