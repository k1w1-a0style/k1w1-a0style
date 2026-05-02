import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch515 github token stays server-side for workflow/log edge paths", () => {
  const logsHook = "hooks/useGitHubActionsLogs.ts";
  const ciLiteHook = "components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts";
  const runsEdge = "supabase/functions/github-workflow-runs/index.ts";
  const logsEdge = "supabase/functions/github-workflow-logs/index.ts";
  const dispatchEdge = "supabase/functions/github-workflow-dispatch/index.ts";
  const sharedGithub = "supabase/functions/_shared/github.ts";
  const sharedValidation = "supabase/functions/_shared/validation.ts";

  it("removes client-side githubToken body passthrough from the productive workflow/log hooks", () => {
    expect(read(logsHook)).not.toContain("githubToken:");
    expect(read(logsHook)).not.toContain("getGitHubToken");
    expect(read(ciLiteHook)).not.toContain("githubToken:");
    expect(read(ciLiteHook)).not.toContain("getGitHubToken");
  });

  it("keeps the targeted edge functions on the shared server-side token helper line", () => {
    for (const rel of [runsEdge, logsEdge, dispatchEdge]) {
      const src = read(rel);
      expect(src).toContain("getGithubToken");
      expect(src).not.toContain("body.githubToken");
      expect(src).not.toContain("body.github_token");
      expect(src).not.toContain("body.ghToken");
      expect(src).not.toContain("body.token");
    }

    expect(read(sharedGithub)).toContain("export function getGithubToken(): string {");
    expect(read(sharedValidation)).not.toContain("githubToken?: string;");
    expect(read(sharedValidation)).not.toContain("errors.githubToken");
  });

  it("keeps the existing admin or service-role guards unchanged on the three edge entry points", () => {
    for (const rel of [runsEdge, logsEdge, dispatchEdge]) {
      expect(read(rel)).toContain("requireOwnerOrJwtAuth(req, {");
    }
  });
});
