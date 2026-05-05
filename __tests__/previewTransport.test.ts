import { resolveWebViewPreviewSource } from "../screens/shared/preview/previewTransport";

describe("preview transport", () => {
  test("converts fragment transport URL into header transport for WebView", () => {
    const source = resolveWebViewPreviewSource({
      type: "url",
      uri: "https://demo.supabase.co/functions/v1/preview_page?transport=fragment#secret=psh_v1_token",
    });

    expect(source).toEqual({
      type: "url",
      uri: "https://demo.supabase.co/functions/v1/preview_page?transport=fragment",
      headers: { "x-k1w1-preview-secret": "psh_v1_token" },
    });
  });

  test("keeps non-fragment URLs unchanged", () => {
    const source = resolveWebViewPreviewSource({ type: "url", uri: "https://example.com/app" });
    expect(source).toEqual({ type: "url", uri: "https://example.com/app" });
  });
});
