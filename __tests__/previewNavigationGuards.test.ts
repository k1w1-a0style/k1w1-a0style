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
      decidePreviewNavigation({ mode: "html", baseOrigin: null, requestUrl: "data:text/html;base64,AA==" }),
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

  test("custom schemes are handed off directly", () => {
    const d = decidePreviewNavigation({
      mode: "url",
      baseOrigin: "https://a.com",
      requestUrl: "mailto:test@example.com",
    });
    expect(d).toEqual({ action: "external_direct", url: "mailto:test@example.com" });
  });
});
