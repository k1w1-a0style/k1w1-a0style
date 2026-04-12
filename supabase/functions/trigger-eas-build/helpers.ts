export async function resolveCommitShaBestEffort(params: {
  githubRepo: string;
  branch: string;
  fetchCommitSha: (input: { githubRepo: string; branch: string }) => Promise<string | null>;
}): Promise<string | null> {
  try {
    return await params.fetchCommitSha({
      githubRepo: params.githubRepo,
      branch: params.branch,
    });
  } catch {
    return null;
  }
}
