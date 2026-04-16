import {
  runGenerateAction,
  runStatusRefreshAction,
} from "../screens/CredentialsWizardScreen/hooks/wizardEdgeActions";
import { invokeEdgeJson } from "../screens/CredentialsWizardScreen/hooks/credentialHelpers";
import type { StatusResult, UiModeId } from "../screens/CredentialsWizardScreen/types";

jest.mock("../screens/CredentialsWizardScreen/hooks/credentialHelpers", () => ({
  ...jest.requireActual("../screens/CredentialsWizardScreen/hooks/credentialHelpers"),
  invokeEdgeJson: jest.fn(),
}));

describe("credentials wizard edge actions", () => {
  const setStatusByMode = jest.fn(
    (
      updater: (
        prev: Record<UiModeId, StatusResult | null>,
      ) => Record<UiModeId, StatusResult | null>,
    ) => updater({ dev: null, preview: null, production: null }),
  );
  const safeSetLastError = jest.fn();
  const safeSetLastDebug = jest.fn();
  const persistWizardStatus = jest.fn(async () => undefined);
  const getCurrentStatusForMode = jest.fn(() => null as StatusResult | null);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("refreshStatus maps successful status results and persists them", async () => {
    (invokeEdgeJson as jest.Mock).mockResolvedValue({
      ok: true,
      data: { exists: true, record: { alias: "android-dev", mode: "development" } },
      debug: { status: 200, bodyText: "ok" },
    });

    const ok = await runStatusRefreshAction({
      mode: "dev",
      userJwt: "jwt",
      supabaseUrl: "https://example.supabase.co",
      adminKey: "admin-key",
      repoFullName: "owner/repo",
      isMounted: () => true,
      setStatusByMode,
      safeSetLastError,
      safeSetLastDebug,
      persistWizardStatus,
      getCurrentStatusForMode,
      opts: { preservePendingOnError: true },
    });

    expect(ok).toBe(true);
    expect(setStatusByMode).toHaveBeenCalled();
    expect(persistWizardStatus).toHaveBeenCalledWith(
      "dev",
      expect.objectContaining({ exists: true, credentialState: "verified" }),
    );
  });

  it("generate sets generated_pending and triggers post-generate refresh", async () => {
    (invokeEdgeJson as jest.Mock).mockResolvedValue({
      ok: true,
      data: { ok: true },
      debug: { status: 200, bodyText: "ok" },
    });

    const onGeneratedPending = jest.fn();
    const refreshStatusAfterGenerate = jest.fn(async () => true);

    await runGenerateAction({
      mode: "preview",
      userJwt: "jwt",
      supabaseUrl: "https://example.supabase.co",
      adminKey: "admin-key",
      repoFullName: "owner/repo",
      isMounted: () => true,
      setStatusByMode,
      safeSetLastError,
      safeSetLastDebug,
      persistWizardStatus,
      getCurrentStatusForMode,
      onGeneratedPending,
      refreshStatusAfterGenerate,
    });

    expect(setStatusByMode).toHaveBeenCalled();
    expect(onGeneratedPending).toHaveBeenCalledTimes(1);
    expect(refreshStatusAfterGenerate).toHaveBeenCalledTimes(1);
    expect(persistWizardStatus).toHaveBeenCalledWith(
      "preview",
      expect.objectContaining({ credentialState: "generated_pending_verification" }),
    );
  });

  it("persists status only after updater returns (no async side effect inside state updater)", async () => {
    (invokeEdgeJson as jest.Mock).mockResolvedValue({
      ok: false,
      error: new Error("forbidden"),
      debug: { status: 403, bodyText: "forbidden" },
    });

    let updaterRunning = false;
    const persistCallsDuringUpdater: number[] = [];
    const setStatusByModeGuarded = jest.fn(
      (
        updater: (
          prev: Record<UiModeId, StatusResult | null>,
        ) => Record<UiModeId, StatusResult | null>,
      ) => {
        updaterRunning = true;
        try {
          return updater({ dev: null, preview: null, production: null });
        } finally {
          updaterRunning = false;
        }
      },
    );
    const persistWizardStatusGuarded = jest.fn(async () => {
      if (updaterRunning) persistCallsDuringUpdater.push(Date.now());
    });

    await runStatusRefreshAction({
      mode: "dev",
      userJwt: "jwt",
      supabaseUrl: "https://example.supabase.co",
      adminKey: "admin-key",
      repoFullName: "owner/repo",
      isMounted: () => true,
      setStatusByMode: setStatusByModeGuarded,
      safeSetLastError,
      safeSetLastDebug,
      persistWizardStatus: persistWizardStatusGuarded,
      getCurrentStatusForMode,
    });

    expect(setStatusByModeGuarded).toHaveBeenCalled();
    expect(persistWizardStatusGuarded).toHaveBeenCalled();
    expect(persistCallsDuringUpdater).toEqual([]);
  });

  it("persists computed error status even when setStatusByMode updater is deferred", async () => {
    (invokeEdgeJson as jest.Mock).mockResolvedValue({
      ok: false,
      error: new Error("forbidden"),
      debug: { status: 403, bodyText: "forbidden" },
    });

    const deferredUpdaters: Array<
      (prev: Record<UiModeId, StatusResult | null>) => Record<UiModeId, StatusResult | null>
    > = [];
    const setStatusByModeDeferred = jest.fn(
      (
        updater: (
          prev: Record<UiModeId, StatusResult | null>,
        ) => Record<UiModeId, StatusResult | null>,
      ) => {
      deferredUpdaters.push(updater);
      },
    );
    const persistedPayloads: Array<StatusResult | null> = [];
    const persistWizardStatusCapture = jest.fn(async (_mode: UiModeId, status: StatusResult | null) => {
      persistedPayloads.push(status);
    });

    await runStatusRefreshAction({
      mode: "dev",
      userJwt: "jwt",
      supabaseUrl: "https://example.supabase.co",
      adminKey: "admin-key",
      repoFullName: "owner/repo",
      isMounted: () => true,
      setStatusByMode: setStatusByModeDeferred,
      safeSetLastError,
      safeSetLastDebug,
      persistWizardStatus: persistWizardStatusCapture,
      getCurrentStatusForMode,
    });

    expect(setStatusByModeDeferred).toHaveBeenCalledTimes(1);
    expect(deferredUpdaters).toHaveLength(1);
    expect(persistWizardStatusCapture).toHaveBeenCalledTimes(1);
    expect(persistedPayloads[0]).toEqual(expect.objectContaining({ exists: false, credentialState: "auth_error" }));
  });
});
