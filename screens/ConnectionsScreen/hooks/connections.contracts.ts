import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import type { VerificationContractState } from "../../../lib/status/verificationContract";

export type ConnectionRequirement = { value: string; message: string };

export type ConnectionPersistenceDelta = {
  writes: Array<[string, string]>;
  removes: string[];
};

export type EasLaunchSelection = {
  githubToken: string;
  repoSlug: string;
  branch: string;
  owner: string;
  repo: string;
};

export type GuardedActionParams = {
  defaultTitle: string;
  task: () => Promise<void>;
  onNonBusyError?: (error: unknown) => Promise<void> | void;
};

export type ConnectionsSecretsState = {
  githubToken: string;
  setGithubToken: (value: string) => void;
  expoToken: string;
  setExpoToken: (value: string) => void;
  workflowAdminKey: string;
  setWorkflowAdminKey: (value: string) => void;
  androidKeystoreExportAdminKey: string;
  setAndroidKeystoreExportAdminKey: (value: string) => void;
  showGitHub: boolean;
  setShowGitHub: (value: boolean | ((prev: boolean) => boolean)) => void;
  showExpo: boolean;
  setShowExpo: (value: boolean | ((prev: boolean) => boolean)) => void;
  showWorkflowAdmin: boolean;
  setShowWorkflowAdmin: (value: boolean | ((prev: boolean) => boolean)) => void;
  showKeystoreAdmin: boolean;
  setShowKeystoreAdmin: (value: boolean | ((prev: boolean) => boolean)) => void;
  showSupabaseAnon: boolean;
  setShowSupabaseAnon: (value: boolean | ((prev: boolean) => boolean)) => void;
  supabaseRaw: string;
  setSupabaseRaw: (value: string) => void;
  supabaseUrl: string;
  setSupabaseUrl: (value: string) => void;
  supabaseAnonKey: string;
  setSupabaseAnonKey: (value: string) => void;
  easProjectId: string;
  setEasProjectId: (value: string) => void;
};

export type UseConnectionsScreenReturn = {
  navigation: NavigationProp<ParamListBase>;
  busy: boolean;
  hydrated: boolean;
  githubConnected: boolean;
  isEasInitRunning: boolean;
  activeRepo: string | null;
  onLinkExisting: () => Promise<void>;
  onCreateAndLink: () => Promise<void>;
  githubOk: boolean;
  githubUser: string;
  githubScopes: string;
  supabaseOk: boolean;
  expoOk: boolean;
  expoUser: string;
  repoOk: boolean;
  repoOkLine: string;
  supabaseRef: string;
  status: {
    gh: boolean;
    ex: boolean;
    edge: boolean;
    sbUrl: boolean;
    sbAnon: boolean;
    linked: boolean;
    eas: boolean;
  };
  repoLine: string;
  selectionSource: "project" | "context" | "none";
  supabaseUrl: string;
  githubToken: string;
  setGithubToken: (value: string) => void;
  expoToken: string;
  setExpoToken: (value: string) => void;
  workflowAdminKey: string;
  setWorkflowAdminKey: (value: string) => void;
  androidKeystoreExportAdminKey: string;
  setAndroidKeystoreExportAdminKey: (value: string) => void;
  showGitHub: boolean;
  setShowGitHub: (value: boolean | ((prev: boolean) => boolean)) => void;
  showExpo: boolean;
  setShowExpo: (value: boolean | ((prev: boolean) => boolean)) => void;
  showWorkflowAdmin: boolean;
  setShowWorkflowAdmin: (value: boolean | ((prev: boolean) => boolean)) => void;
  showKeystoreAdmin: boolean;
  setShowKeystoreAdmin: (value: boolean | ((prev: boolean) => boolean)) => void;
  showSupabaseAnon: boolean;
  setShowSupabaseAnon: (value: boolean | ((prev: boolean) => boolean)) => void;
  supabaseRaw: string;
  setSupabaseRaw: (value: string) => void;
  setSupabaseUrl: (value: string) => void;
  supabaseAnonKey: string;
  setSupabaseAnonKey: (value: string) => void;
  easOk: boolean;
  easState: VerificationContractState;
  easLastVerifiedAt: string | null;
  easProjectId: string;
  setEasProjectId: (value: string) => void;
  saveAll: () => Promise<void>;
  testGitHub: () => Promise<void>;
  testSupabase: () => Promise<void>;
  testExpo: () => Promise<void>;
  testEas: () => Promise<void>;
  isTestingEas: boolean;
};
