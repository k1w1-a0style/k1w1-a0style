import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";

const mockUpdateProjectFiles = jest.fn(async (_files: unknown) => undefined);
const mockAlert = jest.fn();

jest.mock("../contexts/ProjectContext", () => ({
  useProject: () => ({
    projectData: { name: "Demo", files: [] },
    setProjectName: jest.fn(async () => undefined),
    updateProjectFiles: (files: unknown) => mockUpdateProjectFiles(files),
    setPackageName: jest.fn(async () => undefined),
    setLinkedRepo: jest.fn(async () => undefined),
  }),
}));

jest.mock("../contexts/AIContext", () => ({
  useAI: () => ({
    config: {
      apiKeys: { groq: [], gemini: [], openai: [], anthropic: [], huggingface: [] },
    },
    setConfig: jest.fn(),
    assertImportedConfigAllowed: jest.fn(),
    applyImportedConfig: jest.fn(),
  }),
}));

jest.mock("../contexts/GitHubContext", () => ({
  useGitHub: () => ({
    activeRepo: "owner/repo",
    activeBranch: "main",
    recentRepos: [],
    addRecentRepo: jest.fn(),
    clearRecentRepos: jest.fn(),
  }),
}));

jest.mock("../screens/AppInfoScreen/hooks/useAppInfoApiConfigFlow", () => ({
  useAppInfoApiConfigFlow: () => ({
    handleExportAPIConfig: jest.fn(async () => undefined),
    handleImportAPIConfig: jest.fn(async () => undefined),
  }),
}));

jest.mock("../screens/AppInfoScreen/hooks/useAppInfoSecureBackupFlow", () => ({
  useAppInfoSecureBackupFlow: () => ({
    secureBackupRequest: null,
    secureBackupBusy: false,
    closeSecureBackupPrompt: jest.fn(),
    handleSubmitSecureBackupPassphrase: jest.fn(async () => undefined),
    handleExportSecretsBackup: jest.fn(async () => undefined),
    handleExportConfigSecretsBackup: jest.fn(async () => undefined),
    handleImportSecureBackup: jest.fn(async () => undefined),
  }),
}));

const mockRequestMediaLibraryPermissionsAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();

jest.mock("expo-image-picker", () => ({
  MediaTypeOptions: { Images: "Images" },
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) =>
    mockRequestMediaLibraryPermissionsAsync(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
}));

const { useAppInfoScreen } = require("../screens/AppInfoScreen/hooks/useAppInfoScreen");

describe("useAppInfoScreen icon binary flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation((...args: unknown[]) => mockAlert(...args));
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ base64: "QUJD" }],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("writes icon assets using base64: project binary format", async () => {
    const { result } = renderHook(() => useAppInfoScreen());

    await act(async () => {
      await result.current.handleChooseIcon();
    });

    expect(mockUpdateProjectFiles).toHaveBeenCalledTimes(1);
    expect(mockUpdateProjectFiles).toHaveBeenCalledWith([
      { path: "assets/icon.png", content: "base64:QUJD" },
      { path: "assets/adaptive-icon.png", content: "base64:QUJD" },
      { path: "assets/splash.png", content: "base64:QUJD" },
      { path: "assets/favicon.png", content: "base64:QUJD" },
    ]);
  });
});
