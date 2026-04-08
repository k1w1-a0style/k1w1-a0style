export type ConnectionsSavePlan = {
  githubToken: string;
  expoToken: string;
  workflowAdminKey: string;
  androidKeystoreExportAdminKey: string;
  supabaseRaw: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  easProjectId: string;
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
}): ConnectionsSavePlan => {
  const githubToken = params.githubToken.trim();
  const expoToken = params.expoToken.trim();
  const workflowAdminKey = params.workflowAdminKey.trim();
  const androidKeystoreExportAdminKey = params.androidKeystoreExportAdminKey.trim();
  const supabaseRaw = params.supabaseRaw.trim();
  const supabaseUrl = params.supabaseUrl.trim();
  const supabaseAnonKey = params.supabaseAnonKey.trim();
  const easProjectId = params.easProjectId.trim();
  return {
    githubToken,
    expoToken,
    workflowAdminKey,
    androidKeystoreExportAdminKey,
    supabaseRaw,
    supabaseUrl,
    supabaseAnonKey,
    easProjectId,
    shouldClearSupabaseConnection: !supabaseUrl || !supabaseAnonKey,
    shouldClearEasConnection: !easProjectId,
  };
};
