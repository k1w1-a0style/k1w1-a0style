// __tests__/previewNavigationGuards.test.ts
import { decidePreviewNavigation, getOrigin } from "../utils/previewNavigation";

describe("previewNavigation guards", () => {
  test("getOrigin returns origin for valid http url", () => {
    expect(getOrigin("https://example.com/a?b=c")).toBe("https://example.com");
  });

  test("blocks legacy local.preview navigation", () => {
    const d = decidePreviewNavigation({
      mode: "url",
      baseOrigin: "https://a.com",
      requestUrl: "https://local.preview/foo",
    });
    expect(d).toEqual({ action: "block", reason: "local_preview" });
  });

  test("allows about/data/blob", () => {
    expect(
      decidePreviewNavigation({ mode: "html", baseOrigin: null, requestUrl: "about:blank" }),
    ).toEqual({ action: "allow" });

    expect(
      decidePreviewNavigation({
        mode: "html",
        baseOrigin: null,
        requestUrl: "data:text/html;base64,AA==",
      }),
    ).toEqual({ action: "allow" });

    expect(
      decidePreviewNavigation({ mode: "html", baseOrigin: null, requestUrl: "blob:abc" }),
    ).toEqual({ action: "allow" });
  });

  test("html mode: external confirm for http(s)", () => {
    const d = decidePreviewNavigation({
      mode: "html",
      baseOrigin: null,
      requestUrl: "https://example.com",
    });
    expect(d).toEqual({ action: "external_confirm", url: "https://example.com" });
  });

  test("url mode: same-origin allowed, cross-origin external confirm", () => {
    const same = decidePreviewNavigation({
      mode: "url",
      baseOrigin: "https://a.com",
      requestUrl: "https://a.com/page",
    });
    expect(same).toEqual({ action: "allow" });

    const cross = decidePreviewNavigation({
      mode: "url",
      baseOrigin: "https://a.com",
      requestUrl: "https://b.com/page",
    });
    expect(cross).toEqual({ action: "external_confirm", url: "https://b.com/page" });
  });

  test("url mode: fails closed when baseOrigin is null", () => {
    const d = decidePreviewNavigation({
      mode: "url",
      baseOrigin: null,
      requestUrl: "https://example.com/page",
    });
    expect(d).toEqual({ action: "block", reason: "invalid_url" });
  });

  test("safe external schemes are handed off directly", () => {
    const cases = [
      "mailto:test@example.com",
      "tel:+49123456789",
      "sms:+49123456789",
      "geo:52.5200,13.4050",
      "maps:0,0?q=Berlin",
    ];

    for (const url of cases) {
      const d = decidePreviewNavigation({
        mode: "url",
        baseOrigin: "https://a.com",
        requestUrl: url,
      });
      expect(d).toEqual({ action: "external_direct", url });
    }
  });

  test("dangerous/unknown schemes are blocked", () => {
    const cases = [
      "javascript:alert(1)",
      "file:///etc/passwd",
      "intent://evil#Intent;scheme=malicious;end",
      "ftp://example.com",
      "customapp://open?x=1",
    ];

    for (const url of cases) {
      const d = decidePreviewNavigation({
        mode: "url",
        baseOrigin: "https://a.com",
        requestUrl: url,
      });
      expect(d).toEqual({ action: "block", reason: "unsupported_scheme" });
    }
  });

  test("requestUrl is trimmed", () => {
    const d = decidePreviewNavigation({
      mode: "url",
      baseOrigin: "https://a.com",
      requestUrl: "  https://a.com/page  ",
    });
    expect(d).toEqual({ action: "allow" });
  });
});
