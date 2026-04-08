import { useMemo } from "react";

import { resolveConnectionsStatusFlags } from "./useConnectionsScreenHelpers";

type Params = {
  githubToken: string;
  expoToken: string;
  workflowAdminKey: string;
  androidKeystoreExportAdminKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  easProjectId: string;
  linkedRepo?: string | null;
  activeRepo?: string | null;
};

export function useConnectionsStatusModel(params: Params) {
  const status = useMemo(
    () =>
      resolveConnectionsStatusFlags({
        githubToken: params.githubToken,
        expoToken: params.expoToken,
        workflowAdminKey: params.workflowAdminKey,
        androidKeystoreExportAdminKey: params.androidKeystoreExportAdminKey,
        supabaseUrl: params.supabaseUrl,
        supabaseAnonKey: params.supabaseAnonKey,
        linkedRepo: params.linkedRepo,
        activeRepo: params.activeRepo,
        easProjectId: params.easProjectId,
      }),
    [
      params.githubToken,
      params.expoToken,
      params.workflowAdminKey,
      params.androidKeystoreExportAdminKey,
      params.supabaseUrl,
      params.supabaseAnonKey,
      params.easProjectId,
      params.linkedRepo,
      params.activeRepo,
    ],
  );

  const githubConnected = useMemo(() => !!params.githubToken.trim(), [params.githubToken]);

  return {
    status,
    githubConnected,
  };
}
