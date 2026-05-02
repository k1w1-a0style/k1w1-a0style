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
  __setMockStorage?: (next: Record<string, string>) => void;
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

  it("throws an explicit recovery error for encrypted payloads with wrong decrypt key", async () => {
    const project = makeProjectData({
      name: "Encrypted Recovery",
      files: [makeProjectFile("src/recovery.ts", "export const x = 1;")],
      chatHistory: [],
    });

    await saveProjectToStorage(project);
    resetMockSecureStore();
    jest.clearAllMocks();

    await expect(loadProjectFromStorage()).rejects.toThrow(
      /Verschluesseltes Projekt konnte nicht entschluesselt werden/i,
    );
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("does not rekey on read when secure store key is malformed", async () => {
    const project = makeProjectData({
      name: "No Rekey On Read",
      files: [makeProjectFile("src/rekey.ts", "export const guard = true;")],
      chatHistory: [],
    });

    await saveProjectToStorage(project);
    const secureStore = SecureStore as SecureStoreMock;
    secureStore.__setMockStorage?.({
      k1w1_project_storage_key_v1: "broken-key",
    });
    jest.clearAllMocks();

    await expect(loadProjectFromStorage()).rejects.toThrow(/entschluesselt werden/i);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("treats corrupt plaintext payload as recovery error instead of empty storage", async () => {
    seedMockAsyncStorage({
      [PROJECT_STORAGE_KEY]: "{invalid-json",
    });

    await expect(loadProjectFromStorage()).rejects.toThrow(/unverschluesselter Projektstand ist beschaedigt/i);
  });

  it("falls back to plaintext when secure store key read rejects during encrypt", async () => {
    const project = makeProjectData({
      name: "Encrypt Read Failure",
      files: [makeProjectFile("src/fail-closed.ts", "export const failClosed = true;")],
      chatHistory: [],
    });

    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error("securestore read failed"));

    await expect(saveProjectToStorage(project)).resolves.toBeUndefined();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});
