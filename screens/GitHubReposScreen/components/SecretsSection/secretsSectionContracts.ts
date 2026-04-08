import { resolveRepoSecretVerification } from "../../../../lib/status/repoSecretVerification";
import { Ionicons } from "@expo/vector-icons";

export const REQUIRED_SECRETS = ["EXPO_TOKEN", "SUPABASE_URL"] as const;

export const OPTIONAL_SECRETS = [
  "EAS_PROJECT_ID",
  "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
  "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export type RepoSecretContract = ReturnType<typeof resolveRepoSecretVerification>;

export type SecretRow = {
  name: string;
  contract: RepoSecretContract;
};

export type RuntimePresenceState = {
  expoToken: boolean | null;
  workflowAdminKey: boolean | null;
  androidKeystoreExportAdminKey: boolean | null;
};

export type RuntimeCredentialRow = {
  id: "expo" | "workflowAdmin" | "keystoreAdmin";
  title: string;
  repoContract: RepoSecretContract;
  localPresent: boolean | null;
  usageCopy: string;
  repoCopy: string;
  localCopy: string;
};

export type SecretsListVerificationState =
  | "verified"
  | "stale"
  | "auth_error"
  | "missing"
  | "unknown";

export type SummaryPresentation = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  body: string;
};

export type RuntimeSummaryPresentation = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  body: string;
};
