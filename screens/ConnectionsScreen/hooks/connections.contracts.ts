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
  ui: {
    busy: boolean;
    hydrated: boolean;
    isTestingEas: boolean;
    isEasInitRunning: boolean;
  };
  connection: {
    githubConnected: boolean;
    githubOk: boolean;
    githubUser: string;
    githubScopes: string;
    supabaseOk: boolean;
    supabaseRef: string;
    expoOk: boolean;
    expoUser: string;
    easOk: boolean;
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
  };
  tokens: {
    githubToken: string;
    setGithubToken: StateSetter<string>;
    expoToken: string;
    setExpoToken: StateSetter<string>;
    workflowAdminKey: string;
    setWorkflowAdminKey: StateSetter<string>;
    androidKeystoreExportAdminKey: string;
    setAndroidKeystoreExportAdminKey: StateSetter<string>;
  };
  visibility: {
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
  };
  supabase: {
    supabaseRaw: string;
    setSupabaseRaw: StateSetter<string>;
    supabaseUrl: string;
    setSupabaseUrl: StateSetter<string>;
    supabaseAnonKey: string;
    setSupabaseAnonKey: StateSetter<string>;
  };
  eas: {
    activeRepo: string | null;
    easProjectId: string;
    setEasProjectId: StateSetter<string>;
    easState: VerificationContractState;
    easLastVerifiedAt: string | null;
    testEas: () => Promise<void>;
    onLinkExisting: () => Promise<void>;
    onCreateAndLink: () => Promise<void>;
  };
  actions: {
    saveAll: () => Promise<void>;
    testGitHub: () => Promise<void>;
    testSupabase: () => Promise<void>;
    testExpo: () => Promise<void>;
  };
};
