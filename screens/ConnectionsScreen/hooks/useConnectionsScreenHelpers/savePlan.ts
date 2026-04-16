export type ConnectionsSavePlan = {
  githubToken: string;
  expoToken: string;
  workflowAdminKey: string;
  androidKeystoreExportAdminKey: string;
  supabaseRaw: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  easProjectId: string;
  shouldClearGitHubConnection: boolean;
  shouldClearExpoConnection: boolean;
  shouldClearSupabaseConnection: boolean;
  shouldClearEasConnection: boolean;
};

export const resolveConnectionsSavePlan = (params: {
  githubToken: string;
  expoToken: string;
  workflowAdminKey: string;
  androidKeystoreExportAdminKey: string;
  supabaseRaw: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  easProjectId: string;
  previous?: {
    githubToken?: string;
    expoToken?: string;
    workflowAdminKey?: string;
    androidKeystoreExportAdminKey?: string;
    supabaseRaw?: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    easProjectId?: string;
  };
}): ConnectionsSavePlan => {
  const githubToken = params.githubToken.trim();
  const expoToken = params.expoToken.trim();
  const workflowAdminKey = params.workflowAdminKey.trim();
  const androidKeystoreExportAdminKey = params.androidKeystoreExportAdminKey.trim();
  const supabaseRaw = params.supabaseRaw.trim();
  const supabaseUrl = params.supabaseUrl.trim();
  const supabaseAnonKey = params.supabaseAnonKey.trim();
  const easProjectId = params.easProjectId.trim();
  const previous = {
    githubToken: params.previous?.githubToken?.trim() ?? "",
    expoToken: params.previous?.expoToken?.trim() ?? "",
    workflowAdminKey: params.previous?.workflowAdminKey?.trim() ?? "",
    androidKeystoreExportAdminKey: params.previous?.androidKeystoreExportAdminKey?.trim() ?? "",
    supabaseRaw: params.previous?.supabaseRaw?.trim() ?? "",
    supabaseUrl: params.previous?.supabaseUrl?.trim() ?? "",
    supabaseAnonKey: params.previous?.supabaseAnonKey?.trim() ?? "",
    easProjectId: params.previous?.easProjectId?.trim() ?? "",
  };
  const githubChanged = previous.githubToken !== githubToken;
  const expoChanged = previous.expoToken !== expoToken;
  const workflowAdminChanged = previous.workflowAdminKey !== workflowAdminKey;
  const keystoreAdminChanged = previous.androidKeystoreExportAdminKey !== androidKeystoreExportAdminKey;
  const supabaseChanged =
    previous.supabaseRaw !== supabaseRaw ||
    previous.supabaseUrl !== supabaseUrl ||
    previous.supabaseAnonKey !== supabaseAnonKey;
  const easProjectChanged = previous.easProjectId !== easProjectId;

  return {
    githubToken,
    expoToken,
    workflowAdminKey,
    androidKeystoreExportAdminKey,
    supabaseRaw,
    supabaseUrl,
    supabaseAnonKey,
    easProjectId,
    shouldClearGitHubConnection: githubChanged,
    shouldClearExpoConnection: expoChanged,
    shouldClearSupabaseConnection: supabaseChanged || !supabaseUrl || !supabaseAnonKey,
    shouldClearEasConnection:
      easProjectChanged || expoChanged || workflowAdminChanged || keystoreAdminChanged || !easProjectId,
  };
};
