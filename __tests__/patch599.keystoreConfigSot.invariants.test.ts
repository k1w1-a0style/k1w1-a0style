import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch599 keystore verify_jwt config SoT invariants", () => {
  it("keeps keystore verify_jwt fail-closed in root supabase config", () => {
    const rootConfig = read("supabase/config.toml");

    expect(rootConfig).toContain("[functions.android-keystore-generate]");
    expect(rootConfig).toMatch(/\[functions\.android-keystore-generate\][\s\S]*?verify_jwt\s*=\s*true/);

    expect(rootConfig).toContain("[functions.android-keystore-status]");
    expect(rootConfig).toMatch(/\[functions\.android-keystore-status\][\s\S]*?verify_jwt\s*=\s*true/);

    expect(rootConfig).toContain("[functions.android-keystore-export]");
    expect(rootConfig).toMatch(/\[functions\.android-keystore-export\][\s\S]*?verify_jwt\s*=\s*true/);
  });

  it("removes function-local keystore config files to avoid split-brain", () => {
    expect(fs.existsSync(path.join(process.cwd(), "supabase/functions/android-keystore-export/config.toml"))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), "supabase/functions/android-keystore-generate/config.toml"))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), "supabase/functions/android-keystore-status/config.toml"))).toBe(false);
  });
});
