import type { BuildPipelineDiagnosticsDeps } from "./buildPipelineDiagnostics.constants";

export type RepoFilePresence = {
  hasAppConfigJs: boolean;
  hasAppConfigTs: boolean;
  hasAppJson: boolean;
  hasEasJson: boolean;
  hasEasProjectJson: boolean;
  hasPackageJson: boolean;
  hasLinkWorkflow: boolean;
  hasTriggeredBuildWorkflow: boolean;
};

const REPO_FILE_PATHS: Record<keyof RepoFilePresence, string> = {
  hasAppConfigJs: "app.config.js",
  hasAppConfigTs: "app.config.ts",
  hasAppJson: "app.json",
  hasEasJson: "eas.json",
  hasEasProjectJson: "eas-project.json",
  hasPackageJson: "package.json",
  hasLinkWorkflow: ".github/workflows/eas-link.yml",
  hasTriggeredBuildWorkflow: ".github/workflows/k1w1-triggered-build.yml",
};

export async function resolveRepoFilePresence(params: {
  owner: string;
  repo: string;
  ref: string;
  deps: BuildPipelineDiagnosticsDeps;
}): Promise<RepoFilePresence> {
  const { owner, repo, ref, deps } = params;

  const entries = await Promise.all(
    (Object.keys(REPO_FILE_PATHS) as Array<keyof RepoFilePresence>).map(async (key) => {
      const exists = await (deps.fileExists?.(owner, repo, REPO_FILE_PATHS[key], ref) ?? Promise.resolve(false));
      return [key, exists] as const;
    }),
  );

  return Object.fromEntries(entries) as RepoFilePresence;
}
