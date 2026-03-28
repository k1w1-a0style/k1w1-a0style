import fs from "node:fs";
import path from "node:path";

import { triggerWorkflow } from "../infra/github/workflows";
import { getDefaultBranch } from "../infra/github/branchOps";

jest.mock("../infra/github/tokenStore", () => ({
  getGitHubToken: jest.fn(async () => "gh-token"),
}));

jest.mock("../infra/github/rateLimit", () => ({
  githubLimiter: { checkLimit: jest.fn(async () => undefined) },
}));

jest.mock("../infra/github/utils", () => {
  const actual = jest.requireActual("../infra/github/utils");
  return {
    ...actual,
    fetchGitHub: jest.fn(),
  };
});

const { fetchGitHub: mockFetchGitHub } = jest.requireMock("../infra/github/utils") as {
  fetchGitHub: jest.Mock;
};

describe("github branch/ref hardening contracts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("triggerWorkflow requires an explicit branch/ref", async () => {
    await expect(
      triggerWorkflow("o", "r", "eas-build.yml", "   "),
    ).rejects.toThrow("Explicit branch/ref is required.");
  });

  test("getDefaultBranch fails closed when repository metadata has no default_branch", async () => {
    mockFetchGitHub.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ default_branch: "   " }),
    } as Response);

    await expect(getDefaultBranch("o", "r")).rejects.toThrow(
      "Repository default_branch is missing.",
    );
  });

  test("android-keystore-generate no longer hard-falls back to main or exposes branch as a contract field", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "supabase/functions/android-keystore-generate/index.ts"),
      "utf8",
    );

    expect(src).not.toContain('safeString(body?.branch) || "main"');
    expect(src).not.toContain("const branch = safeString(body?.branch)");
    expect(src).not.toContain("Invalid branch.");
    expect(src).not.toContain("branch,");
  });
});
