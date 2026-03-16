import { sanitizeChatRetentionLimit } from "../contexts/ProjectContext";

describe("sanitizeChatRetentionLimit", () => {
  it("normalizes valid numbers to floored integers", () => {
    expect(sanitizeChatRetentionLimit(123.9)).toBe(123);
    expect(sanitizeChatRetentionLimit(0)).toBe(0);
  });

  it("falls back for invalid values", () => {
    expect(sanitizeChatRetentionLimit(Number.NaN)).toBe(200);
    expect(sanitizeChatRetentionLimit(-1)).toBe(200);
  });
});
