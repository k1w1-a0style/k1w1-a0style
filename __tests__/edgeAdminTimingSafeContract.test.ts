import { readFileSync } from "fs";
import path from "path";

import { timingSafeSecretEqual } from "../supabase/functions/_shared/auth/timingSafe";

describe("edge admin auth timing-safe compare", () => {
  it("uses shared timing-safe helper instead of direct equality in admin guards", () => {
    const adminPath = path.join(process.cwd(), "supabase/functions/_shared/auth/admin.ts");
    const src = readFileSync(adminPath, "utf8");
    expect(src).toContain("timingSafeSecretEqual");
    expect(src).not.toContain("got === expected");
  });

  it("uses shared timing-safe helper in scoped auth admin-key path", () => {
    const scopedPath = path.join(process.cwd(), "supabase/functions/_shared/auth/scoped.ts");
    const src = readFileSync(scopedPath, "utf8");
    expect(src).toContain("timingSafeSecretEqual");
    expect(src).not.toContain("adminHeader === adminSecret");
  });

  it("fails closed for empty and mismatched inputs and accepts exact match", () => {
    expect(timingSafeSecretEqual("abc", "abc")).toBe(true);
    expect(timingSafeSecretEqual("abc", "abcd")).toBe(false);
    expect(timingSafeSecretEqual("", "abc")).toBe(false);
    expect(timingSafeSecretEqual("abc", "")).toBe(false);
    expect(timingSafeSecretEqual(null, "abc")).toBe(false);
  });
});
