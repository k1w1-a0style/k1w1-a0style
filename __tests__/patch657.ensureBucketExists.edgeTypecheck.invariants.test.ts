import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("patch657 ensureBucketExists edge typecheck contract", () => {
  const helperPath = join(
    process.cwd(),
    "supabase/functions/android-keystore-generate/helpers.ts",
  );

  it("keeps Awaitable-based storage client typing for createBucket + fallback query chain", () => {
    const source = readFileSync(helperPath, "utf8");

    expect(source).toContain("type Awaitable<T> = PromiseLike<T> | Promise<T>;");
    expect(source).toContain(
      'maybeSingle: () => Awaitable<{ error?: { message?: string } | null }>',
    );
    expect(source).toContain("type StorageBucketCreator = {");
    expect(source).toContain(") => Awaitable<{ error?: { message?: string } | null }>;");
    expect(source).toContain("supabase: StorageBucketsQuery & StorageBucketCreator,");
  });
});
