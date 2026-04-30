import fs from "fs";
import path from "path";
import { isAllowedGithubRepo, isAllowedGitRef } from "../supabase/functions/_shared/github";

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

describe("GitHub repo/ref policy invariants", () => {
  it("uses the selected valid repo as source of truth when no optional repo policy is configured", () => {
    withEnv({ K1W1_ALLOWED_GITHUB_REPOS: undefined }, () => {
      expect(isAllowedGithubRepo("owner/repo")).toBe(true);
      expect(isAllowedGithubRepo("bad repo")).toBe(false);
    });

    withEnv({ K1W1_ALLOWED_GITHUB_REPOS: "   " }, () => {
      expect(isAllowedGithubRepo("owner/repo")).toBe(true);
    });

    withEnv({ K1W1_ALLOWED_GITHUB_REPOS: "owner/repo,other/*" }, () => {
      expect(isAllowedGithubRepo("owner/repo")).toBe(true);
      expect(isAllowedGithubRepo("other/future-app")).toBe(true);
      expect(isAllowedGithubRepo("owner/not-allowed")).toBe(false);
    });
  });

  it("uses any syntactically safe branch/tag as source of truth when no optional ref policy is configured", () => {
    withEnv({ K1W1_ALLOWED_REF_REGEX: undefined }, () => {
      expect(isAllowedGitRef("main")).toBe(true);
      expect(isAllowedGitRef("feature/test-build")).toBe(true);
      expect(isAllowedGitRef("refs/heads/main")).toBe(false);
      expect(isAllowedGitRef("main..evil")).toBe(false);
    });
  });

  it("keeps optional trigger/dispatch ref restriction support without raw RegExp execution", () => {
    const trigger = read("supabase/functions/trigger-eas-build/routeCore.ts");
    const dispatch = read("supabase/functions/github-workflow-dispatch/index.ts");
    const shared = read("supabase/functions/_shared/github.ts");

    expect(trigger).toContain("isAllowedGitRef");
    expect(dispatch).toContain("isAllowedGitRef");
    expect(shared).toContain('const regexStr = (getRuntimeEnv("K1W1_ALLOWED_REF_REGEX") ?? "").trim();');
    expect(shared).toContain("if (!regexStr) return true;");
    expect(shared).not.toContain("new RegExp(regexStr)");
    expect(shared).toContain("const wrapped = regexStr.match(/^\\^\\((.+)\\)\\$$/);");
  });
});
