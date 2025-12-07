export const SUPABASE_STORAGE_KEYS = {
  URL: 'supabase_url',
  RAW: 'supabase_raw',
  KEY: 'supabase_key',
} as const;

export type SupabaseProjectDetails = {
  projectId: string;
  url: string;
};

export const deriveSupabaseDetails = (
  rawInput?: string | null,
): SupabaseProjectDetails => {
  const trimmed = rawInput?.trim() ?? '';

  if (!trimmed) {
    return { projectId: '', url: '' };
  }

  const match = trimmed.match(/^https?:\/\/([^.]+)\.supabase\.co/i);
  if (match?.[1]) {
    const id = match[1];
    return {
      projectId: id,
      url: `https://${id}.supabase.co`,
    };
  }

  return {
    projectId: trimmed,
    url: `https://${trimmed}.supabase.co`,
  };
};
