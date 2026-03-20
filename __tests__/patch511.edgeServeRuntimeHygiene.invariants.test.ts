import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

const migratedEntryFiles = [
  "supabase/functions/check-eas-build/index.ts",
  "supabase/functions/create_codesandbox/index.ts",
  "supabase/functions/github-workflow-dispatch/index.ts",
  "supabase/functions/github-workflow-logs/index.ts",
  "supabase/functions/github-workflow-runs/index.ts",
  "supabase/functions/k1w1-handler/index.ts",
  "supabase/functions/preview_page/index.ts",
  "supabase/functions/save_preview/index.ts",
  "supabase/functions/trigger-eas-build/index.ts",
] as const;

const cleanedHelperFiles = [
  "supabase/functions/create_codesandbox/helpers.ts",
  "supabase/functions/github-workflow-logs/helpers.ts",
  "supabase/functions/k1w1-handler/helpers.ts",
  "supabase/functions/preview_page/helpers.ts",
] as const;

describe("patch511 edge serve runtime hygiene invariants", () => {
  it("moves the remaining productive edge entrypoints to native Deno.serve", () => {
    for (const rel of migratedEntryFiles) {
      const src = read(rel);
      expect(src).toContain("Deno.serve(");
      expect(src).not.toContain("\nserve(");
      expect(src).not.toContain("\nserve ");
      expect(src).not.toContain("std/http/server.ts");
      expect(src).not.toContain("/http/server.ts");
    }
  });

  it("removes stale std/http/server helper imports from the cleaned helper files", () => {
    for (const rel of cleanedHelperFiles) {
      const src = read(rel);
      expect(src).not.toContain("std/http/server.ts");
      expect(src).not.toContain("/http/server.ts");
      expect(src).not.toContain("export { serve }");
      expect(src).not.toContain('import { serve }');
    }
  });
});
