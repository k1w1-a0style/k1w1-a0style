import {
  getAndroidKeystoreExportAdminKey,
  getExpoToken,
  getGitHubToken,
  getRepoFileText,
  getWorkflowAdminKey,
  listRepoSecretNames,
} from "../../infra/github/githubService";
import { fileExists, readJsonFile, safeTrim } from "./diagnosticTypes";
import type { DiagnosticCheck } from "./diagnosticTypes";
import {
  type BuildPipelineDiagnosticsDeps,
  type DefaultBuildPipelineDiagnosticsDeps,
} from "./buildPipelineDiagnostics.constants";
import {
  addAppConfigUsageCheck,
  addEasProfileChecks,
  addExpoDevClientCheck,
  addLocalPrerequisiteChecks,
  addProjectIdCheck,
  addRepoConfigChecks,
  addRepoSecretsChecks,
  addWorkflowPresenceChecks,
  detectEasProjectId,
  resolveRepoFilePresence,
} from "./buildPipelineDiagnostics.checks";
import {
  describeRepoSecretContract,
  getRepoSecretCheckTitle,
} from "./buildPipelineDiagnostics.helpers";

export type { DiagnosticStatus, DiagnosticFix, DiagnosticCheck } from "./diagnosticTypes";
export { triggerRemoteDiagnostics, fetchLatestRemoteDiagnosticsReport } from "./remoteDiagnostics";
export type { RemoteDiagnosticsReport } from "./remoteDiagnostics";
export type { BuildPipelineDiagnosticsDeps } from "./buildPipelineDiagnostics.constants";
export { getRepoSecretCheckTitle, describeRepoSecretContract };

const DEFAULT_BUILD_PIPELINE_DIAGNOSTICS_DEPS: DefaultBuildPipelineDiagnosticsDeps = {
  getGitHubToken,
  getExpoToken,
  getWorkflowAdminKey,
  getAndroidKeystoreExportAdminKey,
  fileExists,
  readJsonFile,
  getRepoFileText,
  listRepoSecretNames,
};

export const runBuildPipelineDiagnostics = async (
  params: {
    owner: string;
    repo: string;
    branch?: string | null;
  },
  deps: BuildPipelineDiagnosticsDeps = {},
) => {
  const d = { ...DEFAULT_BUILD_PIPELINE_DIAGNOSTICS_DEPS, ...deps };
  const ref = safeTrim(params.branch);
  if (!ref) throw new Error("Kein Branch ausgewählt.");

  const checks: DiagnosticCheck[] = [];

  await addLocalPrerequisiteChecks(checks, d);

  const fileFlags = await resolveRepoFilePresence({ owner: params.owner, repo: params.repo, ref, deps: d });

  const easJson = await addRepoConfigChecks({
    checks,
    owner: params.owner,
    repo: params.repo,
    ref,
    deps: d,
    hasAppConfigJs: fileFlags.hasAppConfigJs,
    hasAppConfigTs: fileFlags.hasAppConfigTs,
    hasAppJson: fileFlags.hasAppJson,
    hasEasJson: fileFlags.hasEasJson,
  });

  addEasProfileChecks(checks, easJson);

  await addExpoDevClientCheck({
    checks,
    deps: d,
    owner: params.owner,
    repo: params.repo,
    ref,
    hasPackageJson: fileFlags.hasPackageJson,
    easJson,
  });

  const projectId = await detectEasProjectId({
    owner: params.owner,
    repo: params.repo,
    ref,
    deps: d,
    hasEasProjectJson: fileFlags.hasEasProjectJson,
    hasAppJson: fileFlags.hasAppJson,
    hasAppConfigJs: fileFlags.hasAppConfigJs,
    hasAppConfigTs: fileFlags.hasAppConfigTs,
  });
  addProjectIdCheck(checks, ref, projectId);

  addWorkflowPresenceChecks(checks, {
    hasLinkWorkflow: fileFlags.hasLinkWorkflow,
    hasTriggeredBuildWorkflow: fileFlags.hasTriggeredBuildWorkflow,
  });

  await addRepoSecretsChecks({ checks, deps: d, owner: params.owner, repo: params.repo });

  await addAppConfigUsageCheck({
    checks,
    deps: d,
    owner: params.owner,
    repo: params.repo,
    ref,
    hasAppConfigJs: fileFlags.hasAppConfigJs,
  });

  return { ref, checks };
};
