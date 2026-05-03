import type { PersistedCiLiteSnapshot } from "../../../lib/ciLitePersistence";
import type { WorkflowRunLookupDiagnosis } from "./workflowRunMatching";

export const BUILD_ADMIN_FAIL_CLOSED_NOTE =
  "Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim sind fuer diesen Operator-Flow fail-closed blockiert.";
export const BUILD_ADMIN_SERVER_CALLER_NOTE = "JWT role=build_admin (oder service_role fuer Server-Caller)";
export const BUILD_ADMIN_PROVISIONING_NOTE = "ausserhalb dieses Repos per Supabase-User-Claim vergeben";

export type CiLiteOperatorContext = "artifact" | "lookup" | "dispatch";

export type CiLiteOperatorAccess = {
  authMode: "jwt" | "ownerFallback";
  adminKey: string | null;
  userJwt: string | null;
};

export type CiLiteArtifactResult = {
  ok: boolean;
  eslint_exit?: number;
  tsc_exit?: number;
  source_commit_sha?: string;
  source_sha?: string;
  github_sha?: string;
};

export type CiLiteHydratedSnapshot = PersistedCiLiteSnapshot | null;

export type CiLiteLookupFailureMessageBuilder = (params: { workflowLabel: string }) => string;

export type CiLiteLookupTrackingParams = {
  githubRepo: string;
  branch: string;
  jobId: string;
  workflow: string;
  userJwt: string | null;
  expectedEvent: "repository_dispatch" | "workflow_dispatch";
  sourceHeadSha?: string | null;
  mode: "chain" | "default";
  onMatch?: () => void;
  stopLookupOptions?: { chainWaiting?: boolean };
};

export type CiLiteLookupResolution = {
  lookupDiagnosis: WorkflowRunLookupDiagnosis;
  runId: number;
  runUrl: string | null;
};
