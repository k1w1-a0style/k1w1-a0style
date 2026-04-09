import fs from "fs";
import path from "path";

const ROOT = process.cwd();

describe("patch615 preview jwt boundary", () => {
  it("keeps save_preview on a Supabase-login-JWT contract without local legacy admin-key fallback", () => {
    const previewHook = fs.readFileSync(path.join(ROOT, "hooks/usePreview.ts"), "utf8");
    const previewCreation = fs.readFileSync(
      path.join(ROOT, "hooks/usePreviewCreation.ts"),
      "utf8",
    );
    const previewEdge = fs.readFileSync(path.join(ROOT, "supabase/functions/save_preview/index.ts"), "utf8");
    const cfg = fs.readFileSync(path.join(ROOT, "supabase/config.toml"), "utf8");

    expect(previewCreation).toContain("Missing Supabase Preview JWT");
    expect(previewCreation).toContain("bearerJwt: userJwt");
    expect(previewHook).not.toContain("LEGACY_PREVIEW_OPERATOR_MODE_REQUIRED");
    expect(previewHook).not.toContain("getLegacyEdgeAdminKey(");
    expect(previewCreation).not.toContain("LEGACY_PREVIEW_OPERATOR_MODE_REQUIRED");
    expect(previewCreation).not.toContain("getLegacyEdgeAdminKey(");
    expect(previewEdge).toContain('requireVerifiedJwt(req, "save_preview")');
    expect(previewEdge).not.toContain("requireScopedEdgeAuth(req, {");
    expect(cfg).toContain("[functions.save_preview]");
    expect(cfg).toContain("verify_jwt = true");
  });
});
