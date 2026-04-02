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
});
