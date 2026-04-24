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
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it("excludes sensitive files like .npmrc from ZIP payload", async () => {
    const FileSystem = require("expo-file-system/legacy");
    const Sharing = require("expo-sharing");

    Sharing.shareAsync.mockResolvedValueOnce(undefined);

    await exportProjectAsZipFile({
      name: "Demo",
      files: [
        { path: ".npmrc", content: "//registry.npmjs.org/:_authToken=npm_secret_token" },
        { path: "App.tsx", content: "export default function App(){}" },
      ],
      chatHistory: [],
    } as any);

    const writeCalls = FileSystem.writeAsStringAsync.mock.calls.map((call: [string]) => call[0]);
    expect(writeCalls.some((path: string) => path.endsWith("/.npmrc"))).toBe(false);
    expect(writeCalls.some((path: string) => path.endsWith("/App.tsx"))).toBe(true);
  });

  it("does not exclude regular files only because content contains auth-like text", async () => {
    const FileSystem = require("expo-file-system/legacy");
    const Sharing = require("expo-sharing");

    Sharing.shareAsync.mockResolvedValueOnce(undefined);

    await exportProjectAsZipFile({
      name: "Demo",
      files: [
        {
          path: "src/client.ts",
          content: "const sample = 'authorization: Bearer test'; export default sample;",
        },
      ],
      chatHistory: [],
    } as any);

    const writeCalls = FileSystem.writeAsStringAsync.mock.calls.map((call: [string]) => call[0]);
    expect(writeCalls.some((path: string) => path.endsWith("/src/client.ts"))).toBe(true);
  });

  it("blocks traversal paths fail-closed during zip export", async () => {
    await expect(
      exportProjectAsZipFile({
        name: "Demo",
        files: [{ path: "../secrets.txt", content: "x" }],
        chatHistory: [],
      } as any),
    ).rejects.toThrow(/Unsicherer ZIP-Exportpfad erkannt/i);
  });

  it("blocks absolute export paths fail-closed", async () => {
    await expect(
      exportProjectAsZipFile({
        name: "Demo",
        files: [{ path: "/tmp/escape.txt", content: "x" }],
        chatHistory: [],
      } as any),
    ).rejects.toThrow(/Unsicherer ZIP-Exportpfad erkannt/i);
  });

  it("writes to the canonical normalized path, not the raw input path", async () => {
    const FileSystem = require("expo-file-system/legacy");
    const Sharing = require("expo-sharing");
    Sharing.shareAsync.mockResolvedValueOnce(undefined);

    await exportProjectAsZipFile({
      name: "Demo",
      files: [{ path: "src\\nested\\file.ts", content: "export const x = 1;" }],
      chatHistory: [],
    } as any);

    const writeCalls = FileSystem.writeAsStringAsync.mock.calls.map((call: [string]) => call[0]);
    expect(writeCalls.some((path: string) => path.endsWith("/src/nested/file.ts"))).toBe(true);
    expect(writeCalls.some((path: string) => path.includes("\\src\\nested\\file.ts"))).toBe(false);
  });
});
