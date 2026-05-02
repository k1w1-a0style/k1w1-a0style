import fs from "fs";
import path from "path";
import {
  getPreviewServiceRoleKey,
  getPreviewSupabaseUrl,
  getRuntimeEnv,
  getSupabaseUrl,
} from "../supabase/functions/_shared/auth";
import { getGithubToken } from "../supabase/functions/_shared/github";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

function withEnv<T>(patch: Record<string, string | undefined>, run: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(patch)) {
    prev[k] = process.env[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }

  try {
    return run();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  }
}

describe("patch514 build/preview env helper hygiene invariants", () => {
  const sharedAuth = "supabase/functions/_shared/auth.ts";
  const authRuntime = "supabase/functions/_shared/auth/runtime.ts";
  const authAdmin = "supabase/functions/_shared/auth/admin.ts";
  const checkRouteCore = "supabase/functions/check-eas-build/routeCore.ts";
  const triggerRouteCore = "supabase/functions/trigger-eas-build/routeCore.ts";
  const previewHelpers = "supabase/functions/preview_page/helpers.ts";
  const savePreviewIndex = "supabase/functions/save_preview/index.ts";
  const sharedGithub = "supabase/functions/_shared/github.ts";

  it("extends the shared auth helper line for shared runtime env reads", () => {
    const src = read(sharedAuth);
    const runtime = read(authRuntime);
    const admin = read(authAdmin);
    expect(src).toContain("getRuntimeEnv");
    expect(admin).toContain("export function getPreviewSupabaseUrl(): string | null {");
    expect(admin).toContain("export function getPreviewServiceRoleKey(): string | null {");
    expect(runtime).toContain('getRuntimeEnv("K1W1_SUPABASE_URL")');
    expect(runtime).toContain('getRuntimeEnv("SUPABASE_URL")');
    expect(runtime).toContain('getRuntimeEnv("PREVIEW_SUPABASE_URL")');
    expect(runtime).toContain('getRuntimeEnv("PREVIEW_SERVICE_ROLE_KEY")');
  });

  it("removes direct Deno.env reads from the targeted build/preview files", () => {
    for (const rel of [checkRouteCore, triggerRouteCore, previewHelpers, savePreviewIndex]) {
      expect(read(rel)).not.toContain("Deno.env.get(");
    }
  });

  it("uses the shared helper line consistently across the targeted build/preview paths", () => {
    expect(read(checkRouteCore)).toContain("const supabaseUrl = getSupabaseUrl();");
    expect(read(checkRouteCore)).toContain("const serviceRoleKey = getServiceRoleKey(req);");

    expect(read(triggerRouteCore)).toContain("isAllowedGitRef");
    expect(read(triggerRouteCore)).toContain("const supabaseUrl = getSupabaseUrl();");
    expect(read(triggerRouteCore)).toContain("const serviceRoleKey = getServiceRoleKey(req);");
    expect(read(triggerRouteCore)).toContain("const GITHUB_TOKEN = getGithubToken();");

    expect(read(sharedGithub)).toContain('import { getRuntimeEnv } from "./auth.ts";');
    expect(read(sharedGithub)).toContain("export function isAllowedGitRef(");
    expect(read(sharedGithub)).toContain('getRuntimeEnv("GITHUB_TOKEN")');
    expect(read(sharedGithub)).toContain('getRuntimeEnv("GH_TOKEN")');
    expect(read(sharedGithub)).toContain('getRuntimeEnv("GITHUB_API_TOKEN")');
    expect(read(sharedGithub)).not.toContain("Deno.env.get(");

    expect(read(previewHelpers)).toContain("return getPreviewSupabaseUrl() ?? \"\";");
    expect(read(previewHelpers)).toContain("const key = getPreviewServiceRoleKey() ?? \"\";");
    expect(read(previewHelpers)).not.toContain('getRuntimeEnv("TEST_STRICT_CSP")');
    expect(read(previewHelpers)).toContain("resolvePreviewRuntimePolicy");
    expect(read(previewHelpers)).toContain('isTruthyEnv(getRuntimeEnv("PREVIEW_STRICT_CSP"))');
    expect(read(previewHelpers)).toContain('isTruthyEnv(getRuntimeEnv("PREVIEW_ALLOW_UNSAFE_EVAL"))');
    expect(read(previewHelpers)).toContain('isTruthyEnv(getRuntimeEnv("PREVIEW_ALLOW_ESM_SH_CDN"))');

    expect(read(savePreviewIndex)).toContain("const previewSupabaseUrl = getPreviewSupabaseUrl() ?? \"\";");
    expect(read(savePreviewIndex)).toContain(
      "const previewServiceRoleKey = getPreviewServiceRoleKey() ?? \"\";",
    );
  });

  it("keeps build/preview guard contracts on the existing paths", () => {
    expect(read(checkRouteCore)).toContain("requireScopedEdgeAuth(req, {");
    expect(read(triggerRouteCore)).toContain("requireOwnerOrJwtAuth(req, {");
    expect(read(savePreviewIndex)).toContain('guard: await requireVerifiedJwt(request, scope)');
    expect(read(savePreviewIndex)).not.toContain("requireScopedEdgeAuth(req, {");
    expect(read(savePreviewIndex)).not.toContain('adminSecretEnv: "K1W1_EDGE_ADMIN_KEY"');
    expect(read(previewHelpers)).toContain(
      "export { getRequestClientIp, getRequestRateLimitSubject, rateLimit, requireDurableRateLimit, sanitizeErrorText };",
    );
  });

  it("reads shared build/preview env helpers from process.env without Deno and keeps K1W1 alias precedence", () => {
    const oldDeno = (globalThis as { Deno?: unknown }).Deno;
    delete (globalThis as { Deno?: unknown }).Deno;

    try {
      withEnv(
        {
          K1W1_SUPABASE_URL: "https://k1w1.example.supabase.co",
          SUPABASE_URL: "https://fallback.example.supabase.co",
          PREVIEW_SUPABASE_URL: "https://preview.example.supabase.co",
          PREVIEW_SERVICE_ROLE_KEY: "preview-role",
          TEST_STRICT_CSP: "true",
          GITHUB_TOKEN: "github-token-from-node",
        },
        () => {
          expect(getSupabaseUrl()).toBe("https://k1w1.example.supabase.co");
          expect(getPreviewSupabaseUrl()).toBe("https://preview.example.supabase.co");
          expect(getPreviewServiceRoleKey()).toBe("preview-role");
          expect(getRuntimeEnv("TEST_STRICT_CSP")).toBe("true");
          expect(getGithubToken()).toBe("github-token-from-node");
        },
      );
    } finally {
      (globalThis as { Deno?: unknown }).Deno = oldDeno;
    }
  });
});
