import {
  normalizeDiagnosticUploadId,
} from "../lib/diagnostics/diagnosticUploader";

describe("patch409 diagnostics upload id contracts", () => {
  test("accepts positive numeric ids", () => {
    expect(normalizeDiagnosticUploadId(42)).toBe("42");
    expect(normalizeDiagnosticUploadId("42")).toBe("42");
  });

  test("accepts nested id payloads", () => {
    expect(normalizeDiagnosticUploadId({ id: 7 })).toBe("7");
    expect(normalizeDiagnosticUploadId({ id: "7" })).toBe("7");
  });

  test("accepts uuid-like compatibility ids during transition", () => {
    expect(
      normalizeDiagnosticUploadId("11111111-1111-1111-1111-111111111111"),
    ).toBe("11111111-1111-1111-1111-111111111111");
  });

  test("rejects invalid ids", () => {
    expect(normalizeDiagnosticUploadId(null)).toBeNull();
    expect(normalizeDiagnosticUploadId(undefined)).toBeNull();
    expect(normalizeDiagnosticUploadId(0)).toBeNull();
    expect(normalizeDiagnosticUploadId(-1)).toBeNull();
    expect(normalizeDiagnosticUploadId("abc")).toBeNull();
    expect(normalizeDiagnosticUploadId({ id: "abc" })).toBeNull();
  });
});
