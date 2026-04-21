jest.mock("../supabase/functions/_shared/auth.ts", () => ({
  getRuntimeEnv: (name: string) => {
    if (name === "K1W1_ALLOWED_REF_REGEX") return "^(main|develop|release/.+|feature/.+)$";
    return "";
  },
}));

import { isAllowedGitRef } from "../supabase/functions/_shared/github";

describe("isAllowedGitRef", () => {
  it("accepts matching branch refs", () => {
    expect(isAllowedGitRef("main")).toBe(true);
    expect(isAllowedGitRef("release/2026-04")).toBe(true);
  });

  it("rejects unsafe refs", () => {
    expect(isAllowedGitRef("")).toBe(false);
    expect(isAllowedGitRef("refs/heads/main")).toBe(false);
    expect(isAllowedGitRef("a".repeat(40))).toBe(false);
    expect(isAllowedGitRef("unknown-branch")).toBe(false);
  });

  it("fails closed when regex policy uses unsafe metacharacters", () => {
    jest.resetModules();
    jest.doMock("../supabase/functions/_shared/auth.ts", () => ({
      getRuntimeEnv: (name: string) => (name === "K1W1_ALLOWED_REF_REGEX" ? "^(.+)$" : ""),
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { isAllowedGitRef: isolatedIsAllowedGitRef } = require("../supabase/functions/_shared/github");
    expect(isolatedIsAllowedGitRef("main")).toBe(false);
  });
});
