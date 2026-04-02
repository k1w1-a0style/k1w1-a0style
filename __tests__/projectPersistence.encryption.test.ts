import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { loadProjectFromStorage, saveProjectToStorage } from "../infra/storage/projectPersistence";
import { PROJECT_STORAGE_KEY } from "../infra/storage/persistenceHelpers";
import { makeProjectData, makeProjectFile } from "./helpers/projectTestHelpers";
import { resetMockAsyncStorage, seedMockAsyncStorage } from "./helpers/asyncStorageMockHelpers";

jest.mock("../lib/chatPrivacySettings", () => ({
  loadChatHistorySettings: jest.fn(async () => ({ persist: true, retention: 10_000 })),
}));

beforeAll(() => {
  if (!global.crypto?.subtle) {
    Object.defineProperty(global, "crypto", {
      value: require("crypto").webcrypto,
      configurable: true,
    });
  }
});

type SecureStoreMock = typeof SecureStore & {
  __resetMockStorage?: () => void;
};

function resetMockSecureStore() {
  (SecureStore as SecureStoreMock).__resetMockStorage?.();
}

describe("project persistence encryption", () => {
  beforeEach(() => {
    resetMockAsyncStorage();
    resetMockSecureStore();
    jest.clearAllMocks();
  });

  it("stores encrypted project blobs instead of plaintext JSON", async () => {
    const project = makeProjectData({
      name: "Encrypted Project",
      files: [makeProjectFile("App.tsx", "export default function App() { return null; }")],
      chatHistory: [],
    });

    await saveProjectToStorage(project);

    const stored = await AsyncStorage.getItem(PROJECT_STORAGE_KEY);
    expect(stored).toContain('"type":"k1w1-project-storage"');
    expect(stored).not.toContain("Encrypted Project");
    expect(stored).not.toContain("App.tsx");
  });

  it("round-trips encrypted project storage", async () => {
    const project = makeProjectData({
      name: "Roundtrip",
      files: [makeProjectFile("src/index.ts", "console.log('ok');")],
      chatHistory: [],
    });

    await saveProjectToStorage(project);
    const restored = await loadProjectFromStorage();

    expect(restored?.name).toBe("Roundtrip");
    expect(restored?.files?.[0]?.path).toBe("src/index.ts");
  });

  it("loads legacy plaintext storage and opportunistically migrates it to encrypted storage", async () => {
    const legacyProject = makeProjectData({
      name: "Legacy Plaintext",
      files: [makeProjectFile("README.md", "legacy")],
      chatHistory: [],
    });

    seedMockAsyncStorage({
      [PROJECT_STORAGE_KEY]: JSON.stringify(legacyProject),
    });

    const restored = await loadProjectFromStorage();
    expect(restored?.name).toBe("Legacy Plaintext");

    await Promise.resolve();
    await Promise.resolve();

    const migrated = await AsyncStorage.getItem(PROJECT_STORAGE_KEY);
    expect(migrated).toContain('"type":"k1w1-project-storage"');
    expect(migrated).not.toContain("Legacy Plaintext");
  });
});
