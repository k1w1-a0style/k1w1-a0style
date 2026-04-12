import { exportProjectAsZipFile } from "../infra/storage/projectPersistence";

jest.mock("expo-file-system/legacy", () => ({
  __esModule: true,
  default: {
    cacheDirectory: "file:///cache/",
  },
  cacheDirectory: "file:///cache/",
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: {
    UTF8: "utf8",
    Base64: "base64",
  },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockRejectedValue(new Error("share failed")),
}));

jest.mock("react-native-zip-archive", () => ({
  zip: jest.fn().mockResolvedValue("/tmp/export.zip"),
  unzip: jest.fn(),
}));

describe("projectPersistence ZIP export cleanup", () => {
  it("always cleans temp dir and temp zip when export fails after zip", async () => {
    const FileSystem = require("expo-file-system/legacy");

    await expect(
      exportProjectAsZipFile({
        name: "Demo",
        files: [{ path: "App.tsx", content: "export default function App(){}" }],
        chatHistory: [],
      } as any),
    ).rejects.toThrow(/share failed/i);

    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      "file:///cache/zip_temp/projekt-export/",
      expect.objectContaining({ idempotent: true }),
    );
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      "file:///cache/Demo.zip",
      expect.objectContaining({ idempotent: true }),
    );
  });
});
