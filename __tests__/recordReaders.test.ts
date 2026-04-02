import {
  asRecord,
  readBoolean,
  readFiniteNumber,
  readOptionalString,
  readString,
  readStringArray,
  readStringRecord,
} from "../lib/validation/recordReaders";

describe("recordReaders", () => {
  test("normalizes primitive access defensively", () => {
    expect(asRecord({ ok: true })).toEqual({ ok: true });
    expect(asRecord(null)).toBeNull();
    expect(readString("x")).toBe("x");
    expect(readString(12, "fallback")).toBe("fallback");
    expect(readOptionalString("value")).toBe("value");
    expect(readOptionalString("")).toBeNull();
    expect(readFiniteNumber(42)).toBe(42);
    expect(readFiniteNumber(Number.NaN)).toBeNull();
    expect(readBoolean(false)).toBe(false);
    expect(readBoolean("false")).toBeNull();
  });

  test("deduplicates string arrays and validates string records", () => {
    expect(readStringArray([" a ", "a", "", 3, "b"], 10)).toEqual(["a", "b"]);
    expect(readStringRecord({ A: "1", B: "2" })).toEqual({ A: "1", B: "2" });
    expect(readStringRecord({ A: 1 })).toBeNull();
  });
});
