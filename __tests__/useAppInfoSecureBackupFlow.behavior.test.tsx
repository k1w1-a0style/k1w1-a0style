import { Alert } from "react-native";
import { act, renderHook } from "@testing-library/react-native";

import { useAppInfoSecureBackupFlow } from "../screens/AppInfoScreen/hooks/useAppInfoSecureBackupFlow";
import type { AIConfig } from "../contexts/AIContext/models";

jest.mock("../screens/AppInfoScreen/hooks/importExportHelpers", () => ({
  exportEncryptedScopedBackup: jest.fn(),
  importEncryptedScopedBackup: jest.fn(),
}));

const { exportEncryptedScopedBackup, importEncryptedScopedBackup } = jest.requireMock("../screens/AppInfoScreen/hooks/importExportHelpers") as {
  exportEncryptedScopedBackup: jest.Mock;
  importEncryptedScopedBackup: jest.Mock;
};

const baseConfig: AIConfig = {
  version: 1,
  selectedChatProvider: "openai",
  selectedChatMode: "gpt-5.4-mini",
  selectedAgentProvider: "openai",
  selectedAgentMode: "gpt-5.4-mini",
  qualityMode: "balanced",
  agentEnabled: true,
  apiKeys: { groq: [], gemini: [], openai: [], anthropic: [], huggingface: [] },
};

describe("useAppInfoSecureBackupFlow behavior", () => {
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function renderFlow() {
    return renderHook(() =>
      useAppInfoSecureBackupFlow({
        config: baseConfig,
        applyImportedConfig: jest.fn(),
        assertImportedConfigAllowed: jest.fn(),
        github: {
          activeRepo: null,
          activeBranch: null,
          recentRepos: [],
          addRecentRepo: jest.fn(),
          clearRecentRepos: jest.fn(),
          setLinkedRepo: jest.fn(),
        },
      }),
    );
  }

  it("shows provider-unavailable error on export failure", async () => {
    exportEncryptedScopedBackup.mockRejectedValueOnce(
      new Error("Gesichertes Backup ist auf diesem Gerät nicht verfügbar: Crypto-Provider fehlt."),
    );

    const { result } = renderFlow();

    await act(async () => {
      result.current.handleExportSecretsBackup();
    });

    await act(async () => {
      await result.current.handleSubmitSecureBackupPassphrase("correct-horse");
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "Fehler beim gesicherten Backup",
      expect.stringContaining("Crypto-Provider fehlt"),
    );
  });

  it("shows wrong-passphrase and corrupted-file messages on import failure", async () => {
    const { result } = renderFlow();

    importEncryptedScopedBackup.mockRejectedValueOnce(
      new Error("Backup konnte nicht entschlüsselt werden. Passphrase prüfen."),
    );

    await act(async () => {
      result.current.handleImportSecureBackup();
    });

    const confirmCall = alertSpy.mock.calls.find((call) => String(call[0]).includes("Gesichertes Backup importieren"));
    const confirmButtons = (confirmCall?.[2] ?? []) as Array<{ text?: string; onPress?: () => void }>;
    const continueButton = confirmButtons.find((button) => button.text === "Weiter");
    expect(continueButton?.onPress).toBeDefined();

    await act(async () => {
      continueButton?.onPress?.();
    });

    await act(async () => {
      await result.current.handleSubmitSecureBackupPassphrase("wrong-passphrase");
    });

    expect(alertSpy.mock.calls.some((call) => call[0] === "Fehler beim gesicherten Backup"
      && call[1] === "Backup konnte nicht entschlüsselt werden. Passphrase prüfen.")).toBe(true);

    importEncryptedScopedBackup.mockRejectedValueOnce(
      new Error("Backup-Datei ist beschädigt oder kein gültiges JSON."),
    );

    await act(async () => {
      result.current.handleImportSecureBackup();
    });
    const confirmCall2 = [...alertSpy.mock.calls].reverse().find((call) => String(call[0]).includes("Gesichertes Backup importieren"));
    const confirmButtons2 = (confirmCall2?.[2] ?? []) as Array<{ text?: string; onPress?: () => void }>;
    const continueButton2 = confirmButtons2.find((button) => button.text === "Weiter");

    await act(async () => {
      continueButton2?.onPress?.();
    });

    await act(async () => {
      await result.current.handleSubmitSecureBackupPassphrase("wrong-passphrase");
    });

    expect(alertSpy.mock.calls.some((call) => call[0] === "Fehler beim gesicherten Backup"
      && call[1] === "Backup-Datei ist beschädigt oder kein gültiges JSON.")).toBe(true);
  });
});
