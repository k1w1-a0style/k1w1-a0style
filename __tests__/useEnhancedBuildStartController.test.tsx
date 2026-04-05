import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";

import { useEnhancedBuildStartController } from "../screens/EnhancedBuildScreen/hooks/useEnhancedBuildStartController";

describe("useEnhancedBuildStartController", () => {
  const isMountedRef = { current: true };

  beforeEach(() => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("blocks start when buildBlockedReason exists", async () => {
    const startBuild = jest.fn(async () => {});
    const { result } = renderHook(() =>
      useEnhancedBuildStartController({
        hasStartBuild: true,
        startBuild,
        buildProfile: "preview",
        repoValidationValid: true,
        buildBlockedReason: "Diagnostik fehlt",
        sanitizeUiMessage: (s) => s,
        status: "idle",
        isMountedRef,
      }),
    );

    await act(async () => {
      await result.current.onStartBuild();
    });

    expect(startBuild).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith("Nicht bereit", "Diagnostik fehlt");
  });

  test("prevents duplicate startBuild calls while build is in flight", async () => {
    let release: (() => void) | null = null;
    const startBuild = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useEnhancedBuildStartController({
        hasStartBuild: true,
        startBuild,
        buildProfile: "preview",
        repoValidationValid: true,
        buildBlockedReason: null,
        sanitizeUiMessage: (s) => s,
        status: "idle",
        isMountedRef,
      }),
    );

    await act(async () => {
      const first = result.current.onStartBuild();
      const second = result.current.onStartBuild();
      await Promise.resolve();
      release?.();
      await Promise.all([first, second]);
    });

    expect(startBuild).toHaveBeenCalledTimes(1);
  });
});
