import { BusyGuardActiveError, isBusyGuardActiveError } from "../screens/ConnectionsScreen/hooks/busyGuard";

describe("busyGuard", () => {
  it("marks only BusyGuardActiveError as busy guard collisions", () => {
    const busyError = new BusyGuardActiveError();

    expect(isBusyGuardActiveError(busyError)).toBe(true);
    expect(isBusyGuardActiveError(new Error("x"))).toBe(false);
    expect(isBusyGuardActiveError(null)).toBe(false);
  });

  it("uses dedicated error name and message", () => {
    const busyError = new BusyGuardActiveError();

    expect(busyError.name).toBe("BusyGuardActiveError");
    expect(busyError.message).toBe("Ein anderer Save/Test-Lauf ist noch aktiv.");
  });
});
