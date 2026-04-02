declare module "@supabase/supabase-js" {
  export type SupabaseClientLike = Record<string, unknown>;
  export function createClient<TClient extends SupabaseClientLike = SupabaseClientLike>(
    url: string,
    key: string,
    options?: unknown,
  ): TClient;
}
