import fs from "fs";
import path from "path";
import { isAllowedGithubRepo } from "../supabase/functions/_shared/github";

function withEnv<T>(patch: Record<string, string | undefined>, run: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(patch)) {
    prev[k] = process.env[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }

  try {
    return run();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  }
}

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("edge allowlist fail-closed invariants", () => {
  it("fails closed for repo allowlist when K1W1_ALLOWED_GITHUB_REPOS is missing or empty", () => {
    withEnv({ K1W1_ALLOWED_GITHUB_REPOS: undefined }, () => {
      expect(isAllowedGithubRepo("owner/repo")).toBe(false);
    });

    withEnv({ K1W1_ALLOWED_GITHUB_REPOS: "   " }, () => {
      expect(isAllowedGithubRepo("owner/repo")).toBe(false);
    });

    withEnv({ K1W1_ALLOWED_GITHUB_REPOS: "owner/repo,other/repo" }, () => {
      expect(isAllowedGithubRepo("owner/repo")).toBe(true);
      expect(isAllowedGithubRepo("owner/not-allowed")).toBe(false);
    });
  });

  it("keeps trigger/dispatch ref allowlist fail-closed when regex env is missing", () => {
    const trigger = read("supabase/functions/trigger-eas-build/index.ts");
    const dispatch = read("supabase/functions/github-workflow-dispatch/index.ts");

    expect(trigger).toContain('const regexStr = (getRuntimeEnv("K1W1_ALLOWED_REF_REGEX") ?? "").trim();');
    expect(dispatch).toContain('const regexStr = (getRuntimeEnv("K1W1_ALLOWED_REF_REGEX") ?? "").trim();');

    expect(trigger).toContain("if (!regexStr) return false;");
    expect(dispatch).toContain("if (!regexStr) return false;");
  });
});
