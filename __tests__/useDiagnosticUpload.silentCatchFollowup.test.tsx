import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

import { useDiagnosticUpload } from "../screens/DiagnosticScreen/hooks/useDiagnosticUpload";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock("expo-crypto", () => ({
  getRandomBytesAsync: jest.fn(),
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(async () => undefined),
}));

jest.mock("uuid", () => ({
  v4: jest.fn(),
}));

jest.mock("../lib/diagnostics/diagnosticUploader", () => ({
  formatDiagnosticUpload: jest.fn((input) => input),
  uploadDiagnosticToSupabase: jest.fn(async () => ({ id: "u1" })),
}));

jest.mock("../lib/diagnostics/sanitize", () => ({
  sanitizeDiagnosticUpload: jest.fn((input) => input),
  safeTruncateText: jest.fn((input) => input),
}));

function Harness() {
  const projectRef = React.useRef({
    name: "Proj",
    files: [{ path: "App.tsx", content: "export default function App(){return null;}" }],
  });
  const mountedRef = React.useRef(true);
  const hook = useDiagnosticUpload({
    projectRef: projectRef as unknown as React.MutableRefObject<any>,
    mountedRef,
    results: [{ id: "r1", status: "ok" }] as any,
    target: "repo" as any,
  });

  return (
    <>
      <TouchableOpacity testID="copy" onPress={() => void hook.copyReport()}>
        <Text>copy</Text>
      </TouchableOpacity>
    </>
  );
}

describe("useDiagnosticUpload silent catch follow-up", () => {
  const originalCrypto = globalThis.crypto;

  beforeEach(() => {
    jest.clearAllMocks();
    const AsyncStorage = jest.requireMock("@react-native-async-storage/async-storage");
    AsyncStorage.getItem.mockResolvedValue(null);
    const uuid = jest.requireMock("uuid");
    uuid.v4.mockReturnValue("11111111-1111-4111-8111-111111111111");
    globalThis.crypto = originalCrypto;
  });

  afterAll(() => {
    globalThis.crypto = originalCrypto;
  });

  it("keeps copy flow usable when crypto + webcrypto + uuid all fail", async () => {
    const AsyncStorage = jest.requireMock("@react-native-async-storage/async-storage");
    const SecureStore = jest.requireMock("expo-secure-store");
    const Crypto = jest.requireMock("expo-crypto");
    const Clipboard = jest.requireMock("expo-clipboard");
    const { formatDiagnosticUpload } = jest.requireMock("../lib/diagnostics/diagnosticUploader");
    const uuid = jest.requireMock("uuid");

    AsyncStorage.getItem.mockRejectedValueOnce(new Error("storage offline"));
    SecureStore.getItemAsync.mockRejectedValueOnce(new Error("securestore read failed"));
    Crypto.getRandomBytesAsync.mockRejectedValueOnce(new Error("rng failed"));
    globalThis.crypto = {
      getRandomValues: () => {
        throw new Error("webcrypto broken");
      },
    } as any;
    uuid.v4.mockImplementation(() => {
      throw new Error("uuid rng unavailable");
    });
    SecureStore.setItemAsync.mockRejectedValueOnce(new Error("securestore write failed"));

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const screen = render(<Harness />);

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        "[useDiagnosticUpload] failed to load persisted upload cooldown",
        expect.any(Error),
      );
    });

    fireEvent.press(screen.getByTestId("copy"));

    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1);
      expect(formatDiagnosticUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: expect.stringMatching(/^dev_/),
        }),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        "[useDiagnosticUpload] failed to read persisted device ID",
        expect.any(Error),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        "[useDiagnosticUpload] failed to read crypto random bytes; using non-crypto fallback",
        expect.any(Error),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        "[useDiagnosticUpload] global crypto fallback failed; trying uuid fallback",
        expect.any(Error),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        "[useDiagnosticUpload] uuid fallback failed; using non-crypto best-effort fallback",
        expect.any(Error),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        "[useDiagnosticUpload] failed to persist generated device ID",
        expect.any(Error),
      );
    });
  });

  it("uses uuid fallback when expo-crypto fails and webcrypto is unavailable", async () => {
    const SecureStore = jest.requireMock("expo-secure-store");
    const Crypto = jest.requireMock("expo-crypto");
    const { formatDiagnosticUpload } = jest.requireMock("../lib/diagnostics/diagnosticUploader");

    SecureStore.getItemAsync.mockResolvedValueOnce(null);
    Crypto.getRandomBytesAsync.mockRejectedValueOnce(new Error("rng failed"));
    globalThis.crypto = undefined as any;

    const screen = render(<Harness />);
    fireEvent.press(screen.getByTestId("copy"));

    await waitFor(() => {
      expect(formatDiagnosticUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: "dev_11111111111141118111111111111111",
        }),
      );
    });
  });
});
