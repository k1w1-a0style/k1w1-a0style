import fs from "fs";
import path from "path";

const ROOT = process.cwd();

describe("patch615 preview auth boundary", () => {
  it("keeps save_preview on owner-or-jwt auth and app-side jwt-or-admin-key caller fallback", () => {
    const previewHook = fs.readFileSync(path.join(ROOT, "hooks/usePreview.ts"), "utf8");
    const previewCreation = fs.readFileSync(
      path.join(ROOT, "hooks/usePreviewCreation.ts"),
      "utf8",
    );
    const previewEdge = fs.readFileSync(path.join(ROOT, "supabase/functions/save_preview/index.ts"), "utf8");
    const cfg = fs.readFileSync(path.join(ROOT, "supabase/config.toml"), "utf8");

    expect(previewCreation).toContain("Workflow-Admin-Key plus Supabase-Anon-Key wird benötigt");
    expect(previewCreation).toContain("bearerJwt: userJwt");
    expect(previewCreation).toContain("adminKey: trimmedAdminKey");
    expect(previewCreation).toContain("getWorkflowAdminKey()");
    expect(previewHook).not.toContain("LEGACY_PREVIEW_OPERATOR_MODE_REQUIRED");
    expect(previewHook).not.toContain("getLegacyEdgeAdminKey(");
    expect(previewCreation).not.toContain("LEGACY_PREVIEW_OPERATOR_MODE_REQUIRED");
    expect(previewCreation).not.toContain("getLegacyEdgeAdminKey(");
    expect(previewEdge).toContain("requireOwnerOrJwtAuth(req, {");
    expect(previewEdge).toContain("requireVerifiedJwt");
    expect(cfg).toContain("[functions.save_preview]");
    expect(cfg).toContain("verify_jwt = true");
  });
});
