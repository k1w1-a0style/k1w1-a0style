jest.mock(
  "npm:fflate@0.8.2",
  () => ({
    unzipSync: jest.fn(() => ({})),
    strFromU8: jest.fn(() => ""),
  }),
  { virtual: true },
);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { asRecord, asString, parseGithubRepo } =
  require("../supabase/functions/github-workflow-logs/helpers.ts") as typeof import("../supabase/functions/github-workflow-logs/helpers.ts");
const { redactSecrets } =
  require("../supabase/functions/github-workflow-logs/helpers.ts") as typeof import("../supabase/functions/github-workflow-logs/helpers.ts");

describe("github workflow logs helpers", () => {
  it("asRecord returns a record for plain objects", () => {
    expect(asRecord({ ok: true })).toEqual({ ok: true });
    expect(asRecord(null)).toBeUndefined();
    expect(asRecord(["x"])).toBeUndefined();
  });

  it("asString narrows strings only", () => {
    expect(asString("main")).toBe("main");
    expect(asString(123)).toBeUndefined();
  });

  it("parseGithubRepo accepts owner/repo and rejects invalid values", () => {
    expect(parseGithubRepo("openai/gpt")).toEqual({ owner: "openai", repo: "gpt" });
    expect(parseGithubRepo("nope")).toBeNull();
    expect(parseGithubRepo(12)).toBeNull();
  });

  it("redactSecrets masks common credential shapes", () => {
    const input = [
      "user@example.com",
      "Authorization: Bearer abc.def.ghi",
      "token=abcdef123456",
      "https://example.test/path?access_token=tok_123",
    ].join("\n");

    const out = redactSecrets(input);
    expect(out).toContain("<redacted-email>");
    expect(out).toContain("[REDACTED_SECRET]");
    expect(out).not.toContain("abc.def.ghi");
    expect(out).not.toContain("abcdef123456");
    expect(out).not.toContain("tok_123");
  });
});
