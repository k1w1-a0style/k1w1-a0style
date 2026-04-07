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
  it("logs persisted-cooldown and device-id fallback errors visibly", async () => {
    const AsyncStorage = jest.requireMock("@react-native-async-storage/async-storage");
    const SecureStore = jest.requireMock("expo-secure-store");
    const Crypto = jest.requireMock("expo-crypto");

    AsyncStorage.getItem.mockRejectedValueOnce(new Error("storage offline"));
    SecureStore.getItemAsync.mockRejectedValueOnce(new Error("securestore read failed"));
    Crypto.getRandomBytesAsync.mockRejectedValueOnce(new Error("rng failed"));
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
      expect(warnSpy).toHaveBeenCalledWith(
        "[useDiagnosticUpload] failed to read persisted device ID",
        expect.any(Error),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        "[useDiagnosticUpload] failed to read crypto random bytes; using fallback",
        expect.any(Error),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        "[useDiagnosticUpload] failed to persist generated device ID",
        expect.any(Error),
      );
    });
  });
});
