declare module "@supabase/supabase-js" {
  export type SupabaseClientLike = Record<string, unknown>;
  export function createClient(
    url: string,
    key: string,
    options?: unknown,
  ): SupabaseClientLike;
}
