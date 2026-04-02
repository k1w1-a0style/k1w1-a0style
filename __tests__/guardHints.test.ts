import { extractGuardHints, hasGuardHint } from "../lib/guardHints";

describe("guardHints", () => {
  it("detects guard markers case-insensitively", () => {
    expect(hasGuardHint(["Ownership BLOCK in file"])).toBe(true);
    expect(hasGuardHint(["manual-only update"])).toBe(true);
  });

  it("ignores non-guard hints", () => {
    expect(hasGuardHint(["rename suggested", "format update"])).toBe(false);
  });

  it("extracts only matching guard entries", () => {
    expect(
      extractGuardHints([
        "safe change",
        "baseline file is read-only",
        "manual-only required",
      ]),
    ).toEqual(["baseline file is read-only", "manual-only required"]);
  });
});
