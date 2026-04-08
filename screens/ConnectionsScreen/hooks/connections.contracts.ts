import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import type { Dispatch, SetStateAction } from "react";
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

type StateSetter<T> = Dispatch<SetStateAction<T>>;

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
  setGithubToken: StateSetter<string>;
  expoToken: string;
  setExpoToken: StateSetter<string>;
  workflowAdminKey: string;
  setWorkflowAdminKey: StateSetter<string>;
  androidKeystoreExportAdminKey: string;
  setAndroidKeystoreExportAdminKey: StateSetter<string>;
  showGitHub: boolean;
  setShowGitHub: StateSetter<boolean>;
  showExpo: boolean;
  setShowExpo: StateSetter<boolean>;
  showWorkflowAdmin: boolean;
  setShowWorkflowAdmin: StateSetter<boolean>;
  showKeystoreAdmin: boolean;
  setShowKeystoreAdmin: StateSetter<boolean>;
  showSupabaseAnon: boolean;
  setShowSupabaseAnon: StateSetter<boolean>;
  supabaseRaw: string;
  setSupabaseRaw: StateSetter<string>;
  setSupabaseUrl: StateSetter<string>;
  supabaseAnonKey: string;
  setSupabaseAnonKey: StateSetter<string>;
  easOk: boolean;
  easState: VerificationContractState;
  easLastVerifiedAt: string | null;
  easProjectId: string;
  setEasProjectId: StateSetter<string>;
  saveAll: () => Promise<void>;
  testGitHub: () => Promise<void>;
  testSupabase: () => Promise<void>;
  testExpo: () => Promise<void>;
  testEas: () => Promise<void>;
  isTestingEas: boolean;
};
