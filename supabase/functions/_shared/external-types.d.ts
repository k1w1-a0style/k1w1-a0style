declare module "@supabase/supabase-js" {
  export type SupabaseErrorLike = {
    message?: string;
    code?: string;
  };

  export type SupabaseResponseLike<TData = unknown> = {
    data: TData;
    error: SupabaseErrorLike | null;
  };

  export interface SupabaseQueryBuilderLike
    extends PromiseLike<SupabaseResponseLike<unknown>> {
    select(columns?: string): SupabaseQueryBuilderLike;
    eq(column: string, value: unknown): SupabaseQueryBuilderLike;
    insert(values: unknown): SupabaseQueryBuilderLike;
    upsert(values: unknown, options?: unknown): SupabaseQueryBuilderLike;
    single(): Promise<SupabaseResponseLike<Record<string, unknown>>>;
    maybeSingle(): Promise<SupabaseResponseLike<Record<string, unknown> | null>>;
  }

  export interface SupabaseStorageBucketLike {
    upload(
      path: string,
      body: Blob,
      options?: unknown,
    ): Promise<SupabaseResponseLike<unknown>>;
    download(path: string): Promise<SupabaseResponseLike<Blob | null>>;
    list(
      path?: string,
      options?: unknown,
    ): Promise<SupabaseResponseLike<Array<{ name?: string }>>>;
  }

  export interface SupabaseStorageLike {
    from(bucket: string): SupabaseStorageBucketLike;
    createBucket(
      bucket: string,
      options: { public: boolean; fileSizeLimit: string },
    ): Promise<SupabaseResponseLike<unknown>>;
  }

  export interface SupabaseClientLike {
    from(table: string): SupabaseQueryBuilderLike;
    storage: SupabaseStorageLike;
  }

  export function createClient<TClient extends SupabaseClientLike = SupabaseClientLike>(
    url: string,
    key: string,
    options?: unknown,
  ): TClient;
}
