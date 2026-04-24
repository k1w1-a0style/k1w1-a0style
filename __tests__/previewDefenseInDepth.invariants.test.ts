import fs from "fs";
import path from "path";
import { buildCsp, html, isValidPreviewSecretFormat } from "../supabase/functions/preview_page/helpers";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

const wildcardLiterals = [
  "originWhitelist={['*']}",
  'originWhitelist={["*"]}',
  "return ['*']",
  'return ["*"]',
  "const originWhitelist = ['*']",
  'const originWhitelist = ["*"]',
];

describe("preview/webview defense-in-depth invariants", () => {
  it("save_preview emits fragment links with hashed preview secret only", () => {
    const src = read("supabase/functions/save_preview/index.ts");

    expect(src).toContain("const storedSecret = await hashPreviewSecret(secret)");
    expect(src).toContain("#secret=${encodeURIComponent(storedSecret)}");
    expect(src).not.toContain("#secret=${encodeURIComponent(secret)}");
  });

  it("preview_page keeps toggle links on single-hash semantics (no hash(hash(secret)))", () => {
    const src = read("supabase/functions/preview_page/index.ts");

    expect(src).toContain("isHashedPreviewSecret(secret)");
    expect(src).toContain("? secret.trim()\n        : await hashPreviewSecret(secret)");
    expect(src).toContain("secretHash: safeToggleSecret");
  });

  it("missing/invalid preview secrets stay fail-closed", () => {
    const src = read("supabase/functions/preview_page/index.ts");

    expect(src).toContain("if (!secret)");
    expect(src).toContain("Missing preview secret header.");
    expect(src).toContain("if (!isValidPreviewSecretFormat(secret))");
    expect(isValidPreviewSecretFormat("")).toBe(false);
    expect(isValidPreviewSecretFormat("bad secret with spaces")).toBe(false);
  });

  it("preview page CSP keeps nonce-based script policy and avoids unsafe-inline scripts", async () => {
    const nonce = "nonce-defense";
    const csp = buildCsp(nonce);

    expect(csp).toContain(`script-src 'self' 'nonce-${nonce}'`);
    const scriptDirective = csp
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("script-src"));
    expect(scriptDirective).toBeDefined();
    expect(scriptDirective).not.toContain("'unsafe-inline'");

    const res = html("<html></html>", nonce, 200);
    expect(res.headers.get("Content-Security-Policy")).toContain(`'nonce-${nonce}'`);
  });

  it("webview navigation/originWhitelist contracts reject wildcard literals in hooks and rendered WebViews", () => {
    const navSrc = read("utils/previewNavigation.ts");
    const webViewHookSrc = read("screens/shared/preview/useWebViewNavigation.ts");
    const previewScreenSrc = read("screens/PreviewScreen/components/DeviceFrame.tsx");
    const fullscreenSrc = read("screens/PreviewFullscreenScreen/PreviewFullscreenScreen.tsx");
    const previewScreenHookSrc = read("screens/PreviewScreen/hooks/usePreviewScreen.ts");
    const fullscreenHookSrc = read("screens/PreviewFullscreenScreen/hooks/usePreviewFullscreen.ts");

    expect(navSrc).toContain('return { action: "external_confirm", url: requestUrl };');
    expect(navSrc).toContain('return { action: "block", reason: "unsupported_scheme" };');

    for (const forbidden of wildcardLiterals) {
      expect(webViewHookSrc).not.toContain(forbidden);
      expect(previewScreenSrc).not.toContain(forbidden);
      expect(fullscreenSrc).not.toContain(forbidden);
      expect(previewScreenHookSrc).not.toContain(forbidden);
      expect(fullscreenHookSrc).not.toContain(forbidden);
    }

    expect(previewScreenSrc).toContain("originWhitelist={originWhitelist}");
    expect(fullscreenSrc).toContain("originWhitelist={originWhitelist}");
    expect(previewScreenHookSrc).toContain("const { originWhitelist, handleShouldStartLoad } = useWebViewNavigation");
    expect(fullscreenHookSrc).toContain("const { baseOrigin, originWhitelist, handleShouldStartLoad } = useWebViewNavigation");
    expect(webViewHookSrc).toContain("if (mode === 'html') return ['data:*', 'about:*', 'blob:*'];");
    expect(webViewHookSrc).toContain("if (mode === 'url' && baseOrigin)");

    expect(previewScreenSrc).toContain("mixedContentMode={getPreviewMixedContentMode()}");
    expect(fullscreenSrc).toContain("mixedContentMode={getPreviewMixedContentMode()}");
  });

  it("preview HTML/render path never embeds raw preview-secret handoff headers into markup", () => {
    const renderSrc = read("supabase/functions/preview_page/render.ts");

    expect(renderSrc).toContain('"x-k1w1-preview-secret": secret');
    expect(renderSrc).not.toContain("?secret=");
    expect(renderSrc).not.toContain("document.body.dataset.previewSecret");
  });
});
