import type {
  getAndroidKeystoreExportAdminKey,
  getExpoToken,
  getGitHubToken,
  getRepoFileText,
  getWorkflowAdminKey,
  listRepoSecretNames,
} from "../../infra/github/githubService";
import { fileExists, readJsonFile } from "./diagnosticTypes";

export type BuildPipelineDiagnosticsDeps = {
  getGitHubToken?: typeof getGitHubToken;
  getExpoToken?: typeof getExpoToken;
  /** @deprecated legacy test-compat shim; workflowAdminKey replaced edgeAdminKey */
  getLegacyEdgeAdminKey?: () => Promise<string | null>;
  getWorkflowAdminKey?: typeof getWorkflowAdminKey;
  getAndroidKeystoreExportAdminKey?: typeof getAndroidKeystoreExportAdminKey;
  fileExists?: typeof fileExists;
  readJsonFile?: typeof readJsonFile;
  getRepoFileText?: typeof getRepoFileText;
  listRepoSecretNames?: typeof listRepoSecretNames;
};

export type DefaultBuildPipelineDiagnosticsDeps = Required<
  Omit<BuildPipelineDiagnosticsDeps, "getLegacyEdgeAdminKey">
>;

export const CANONICAL_EAS_JSON = {
  cli: { version: ">= 10.0.0" },
  build: {
    development: {
      distribution: "internal",
      android: { buildType: "apk", withoutCredentials: true },
    },
    preview: {
      distribution: "internal",
      android: { buildType: "apk", withoutCredentials: true },
    },
    production: {
      android: { buildType: "apk", withoutCredentials: false },
    },
  },
};

export type EasProfileName = "development" | "preview" | "production";
export type EasProfileConfig = {
  android?: {
    buildType?: unknown;
    withoutCredentials?: unknown;
  };
  developmentClient?: unknown;
  distribution?: unknown;
};
export type EasConfig = {
  build?: Partial<Record<EasProfileName, EasProfileConfig>>;
};

export const EAS_PROFILES: EasProfileName[] = ["development", "preview", "production"];

export const canonicalEasJsonString = () => `${JSON.stringify(CANONICAL_EAS_JSON, null, 2)}\n`;

export const getProfileLabel = (profile: string) =>
  profile === "production" ? "full (production)" : profile;
