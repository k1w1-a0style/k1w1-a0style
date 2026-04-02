import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("external supabase type contracts", () => {
  it("keeps createClient return type callable for query and storage usage", () => {
    const src = read("supabase/functions/_shared/external-types.d.ts");

    expect(src).toContain("export interface SupabaseClientLike");
    expect(src).toContain("from(table: string): SupabaseQueryBuilderLike;");
    expect(src).toContain("storage: SupabaseStorageLike;");
    expect(src).toContain(
      "export function createClient<TClient extends SupabaseClientLike = SupabaseClientLike>(",
    );
  });

  it("keeps minimal query-chain methods used in edge handlers", () => {
    const src = read("supabase/functions/_shared/external-types.d.ts");

    expect(src).toContain("select(columns?: string): SupabaseQueryBuilderLike;");
    expect(src).toContain("eq(column: string, value: unknown): SupabaseQueryBuilderLike;");
    expect(src).toContain("insert(values: unknown): SupabaseQueryBuilderLike;");
    expect(src).toContain("upsert(values: unknown, options?: unknown): SupabaseQueryBuilderLike;");
    expect(src).toContain("single(): Promise<SupabaseResponseLike<Record<string, unknown>>>;");
    expect(src).toContain(
      "maybeSingle(): Promise<SupabaseResponseLike<Record<string, unknown> | null>>;",
    );
  });
});
