import fs from "fs";
import path from "path";
import React from "react";
import { Animated } from "react-native";
import { render, renderHook } from "@testing-library/react-native";
import {
  buildCsp,
  html,
  isPreviewTtlValid,
  isValidPreviewSecretFormat,
  resolvePreviewRuntimePolicy,
} from "../supabase/functions/preview_page/helpers";
import { renderFragmentBootstrapPage, renderPage } from "../supabase/functions/preview_page/render";
import { useWebViewNavigation } from "../screens/shared/preview/useWebViewNavigation";
import { DeviceFrame } from "../screens/PreviewScreen/components/DeviceFrame";
import PreviewFullscreenScreen from "../screens/PreviewFullscreenScreen";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const webViewPropsStore: Array<Record<string, unknown>> = [];
const mockUsePreviewFullscreen = jest.fn();

jest.mock("react-native-webview", () => {
  const ReactLib = require("react");
  const { View } = require("react-native");
  const MockWebView = ReactLib.forwardRef((props: Record<string, unknown>, _ref: unknown) => {
    webViewPropsStore.push(props);
    return ReactLib.createElement(View, { testID: "mock-webview" });
  });

  return { WebView: MockWebView, default: MockWebView };
});

jest.mock("../screens/PreviewFullscreenScreen/hooks/usePreviewFullscreen", () => ({
  usePreviewFullscreen: () => mockUsePreviewFullscreen(),
}));

describe("preview/webview defense-in-depth invariants", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

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

  it("preview secret format validation stays fail-closed for invalid/malformed values", () => {
    expect(isValidPreviewSecretFormat("")).toBe(false);
    expect(isValidPreviewSecretFormat("   ")).toBe(false);
    expect(isValidPreviewSecretFormat("bad secret with spaces")).toBe(false);
    expect(isValidPreviewSecretFormat("short")).toBe(false);
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
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("Pragma")).toBe("no-cache");
    expect(res.headers.get("Surrogate-Control")).toBe("no-store");
  });

  it("production defaults fail-closed for preview CSP policy", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
    };
    delete process.env.PREVIEW_STRICT_CSP;
    delete process.env.PREVIEW_ALLOW_UNSAFE_EVAL;
    delete process.env.PREVIEW_ALLOW_ESM_SH_CDN;

    const policy = resolvePreviewRuntimePolicy();
    expect(policy.strictCsp).toBe(true);
    expect(policy.allowUnsafeEval).toBe(false);
    expect(policy.allowEsmShCdn).toBe(false);

    const csp = buildCsp("nonce-prod");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("https://esm.sh");
  });

  it("preview TTL gate denies missing, negative and overly long TTL", () => {
    expect(isPreviewTtlValid(null, null)).toBe(false);
    expect(isPreviewTtlValid("2026-04-25T12:00:00.000Z", "2026-04-25T11:59:00.000Z")).toBe(false);
    expect(isPreviewTtlValid("2026-04-25T12:00:00.000Z", "2026-04-25T14:30:00.000Z")).toBe(false);
    expect(isPreviewTtlValid("2026-04-25T12:00:00.000Z", "2026-04-25T13:00:00.000Z")).toBe(true);
  });

  it("webview navigation/originWhitelist contracts stay scoped at runtime without wildcard allow-all entries", () => {
    const htmlMode = renderHook(() => useWebViewNavigation({ mode: "html" }));
    expect(htmlMode.result.current.originWhitelist).toEqual(["data:*", "about:*", "blob:*"]);
    expect(htmlMode.result.current.originWhitelist).not.toContain("*");

    const urlMode = renderHook(() =>
      useWebViewNavigation({ mode: "url", url: "https://preview.example.com/app" }),
    );
    expect(urlMode.result.current.baseOrigin).toBe("https://preview.example.com");
    expect(urlMode.result.current.originWhitelist).toEqual([
      "https://preview.example.com",
      "https://preview.example.com/*",
      "data:*",
      "about:*",
      "blob:*",
    ]);
    expect(urlMode.result.current.originWhitelist).not.toContain("*");
  });

  it("DeviceFrame WebView callsite forwards restrictive originWhitelist without wildcard allow-all", () => {
    webViewPropsStore.length = 0;
    const originWhitelist = ["https://preview.example.com", "https://preview.example.com/*", "data:*", "about:*", "blob:*"];

    render(
      React.createElement(DeviceFrame, {
        webViewRef: { current: null },
        previewSource: { type: "url", uri: "https://preview.example.com/app" },
        cycleId: 1,
        phase: "ready",
        fadeAnim: new Animated.Value(1),
        flashBorderAnim: new Animated.Value(0),
        originWhitelist,
        onShouldStartLoadWithRequest: jest.fn(() => true),
        onLoadStart: jest.fn(),
        onLoadEnd: jest.fn(),
        onError: jest.fn(),
        onHttpError: jest.fn(),
        onContentProcessDidTerminate: jest.fn(),
        onRenderProcessGone: jest.fn(() => true),
        onCreate: jest.fn(),
      }),
    );

    const latestProps = webViewPropsStore[webViewPropsStore.length - 1] as { originWhitelist?: string[] };
    expect(latestProps.originWhitelist).toEqual(originWhitelist);
    expect(latestProps.originWhitelist).not.toContain("*");
  });

  it("PreviewFullscreenScreen WebView callsite forwards restrictive hook whitelist without wildcard allow-all", () => {
    webViewPropsStore.length = 0;
    const restrictiveWhitelist = [
      "https://preview.example.com",
      "https://preview.example.com/*",
      "data:*",
      "about:*",
      "blob:*",
    ];

    mockUsePreviewFullscreen.mockReturnValue({
      title: "Preview",
      url: "https://preview.example.com/app",
      html: null,
      baseUrl: null,
      mode: "url",
      hasUrlParseError: false,
      originWhitelist: restrictiveWhitelist,
      loading: false,
      error: null,
      canGoBack: false,
      canGoForward: false,
      webViewRef: { current: null },
      handleGoBack: jest.fn(),
      handleWebViewGoBack: jest.fn(),
      handleWebViewGoForward: jest.fn(),
      handleReload: jest.fn(),
      handleShare: jest.fn(),
      handleOpenExternal: jest.fn(),
      handleLoadStart: jest.fn(),
      handleLoadEnd: jest.fn(),
      handleNavigationStateChange: jest.fn(),
      handleShouldStartLoad: jest.fn(() => true),
      handleError: jest.fn(),
      handleHttpError: jest.fn(),
      handleContentProcessDidTerminate: jest.fn(),
      handleRenderProcessGone: jest.fn(() => true),
      headerSubtitle: "Remote Preview",
    });

    render(React.createElement(PreviewFullscreenScreen));

    const latestProps = webViewPropsStore[webViewPropsStore.length - 1] as { originWhitelist?: string[] };
    expect(latestProps.originWhitelist).toEqual(restrictiveWhitelist);
    expect(latestProps.originWhitelist).not.toContain("*");
  });

  it("WebView callsites keep direct wildcard-allow-all originWhitelist literals out of source", () => {
    const deviceFrameSource = read("screens/PreviewScreen/components/DeviceFrame.tsx");
    const fullscreenSource = read("screens/PreviewFullscreenScreen/PreviewFullscreenScreen.tsx");

    const forbiddenSnippets = [
      "originWhitelist={['*']}",
      'originWhitelist={["*"]}',
      "originWhitelist={[...originWhitelist, '*']}",
      'originWhitelist={[...originWhitelist, "*"]}',
    ];

    for (const snippet of forbiddenSnippets) {
      expect(deviceFrameSource).not.toContain(snippet);
      expect(fullscreenSource).not.toContain(snippet);
    }
  });

  it("preview HTML render path uses header-based secret handoff and does not leak query-style secret parameters", () => {
    const bootstrapPage = renderFragmentBootstrapPage({ nonce: "nonce-bootstrap" });
    const page = renderPage({
      nonce: "nonce-render",
      name: "Preview",
      createdAt: "2026-04-25 12:00",
      expiresAt: "2026-04-25 13:00",
      files: { "/App.tsx": { contents: "export default function App(){ return null; }" } },
      showRawLogs: false,
      showRuntimeErrors: false,
      allowEsmShCdn: true,
      logsToggleUrl: "https://example.test/functions/v1/preview_page?logs=1&runtime_errors=0#secret=hash123",
      runtimeErrorsToggleUrl:
        "https://example.test/functions/v1/preview_page?logs=0&runtime_errors=1#secret=hash123",
    });

    expect(bootstrapPage).toContain('"x-k1w1-preview-secret": secret');
    expect(bootstrapPage).toContain('current.searchParams.get("transport") !== "fragment"');
    expect(bootstrapPage).toContain('page.includes(\'data-k1w1-preview-context="isolated"\')');
    expect(page).toContain("#secret=hash123");
    expect(page).not.toContain("?secret=");
    expect(page).toContain("ALLOW_ESM_SH_CDN");
    expect(page).toContain("showError(e);");
    expect(bootstrapPage).not.toContain("document.body.dataset.previewSecret");
  });

  it("preview_page index keeps verify_jwt=false compensated by hashed secret gate and never logs secret values", () => {
    const src = read("supabase/functions/preview_page/index.ts");

    expect(src).toContain("if (!isHashedPreviewSecret(secret))");
    expect(src).toContain("message: \"Preview token must be a hashed secret token.\"");
    expect(src).not.toContain("secret=${secret}");
    expect(src).not.toContain("console.warn(secret)");
  });
});
