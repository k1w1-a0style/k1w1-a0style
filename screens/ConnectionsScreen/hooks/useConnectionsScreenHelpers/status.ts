export const buildRepoOkLine = (repoSlug: string | null, repoBranch: string | null): string => {
  const slug = String(repoSlug ?? "").trim();
  const branch = String(repoBranch ?? "").trim();
  if (slug && branch) return `${slug} (${branch})`;
  if (slug) return slug;
  return "";
};

export const resolveConnectionsStatusFlags = (params: {
  githubToken: string;
  expoToken: string;
  workflowAdminKey: string;
  androidKeystoreExportAdminKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  linkedRepo: string | null | undefined;
  activeRepo: string | null | undefined;
  easProjectId: string;
}): {
  gh: boolean;
  ex: boolean;
  edge: boolean;
  sbUrl: boolean;
  sbAnon: boolean;
  linked: boolean;
  eas: boolean;
} => {
  const gh = !!params.githubToken.trim();
  const ex = !!params.expoToken.trim();
  const edge =
    !!params.workflowAdminKey.trim() ||
    !!params.androidKeystoreExportAdminKey.trim();
  const sbUrl = !!params.supabaseUrl.trim();
  const sbAnon = !!params.supabaseAnonKey.trim();
  const linked = !!(params.linkedRepo || params.activeRepo);
  const eas = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    params.easProjectId.trim(),
  );
  return { gh, ex, edge, sbUrl, sbAnon, linked, eas };
};

export const resolveMissingConnectionRequirements = (
  requirements: Array<{ value: string; message: string }>,
): string | null => {
  for (const requirement of requirements) {
    if (!requirement.value.trim()) {
      return requirement.message;
    }
  }
  return null;
};
