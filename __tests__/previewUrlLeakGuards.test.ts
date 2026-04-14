import fs from "fs";
import path from "path";
import { redactPreviewUrl } from "../screens/shared/preview/previewUrlRedaction";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("preview URL leak guards", () => {
  test("redactPreviewUrl masks fragment/query secrets for display", () => {
    expect(redactPreviewUrl("https://example.com/preview#secret=abc123")).toBe(
      "example.com/preview#secret=••••",
    );
    expect(redactPreviewUrl("https://example.com/preview?token=abc123")).toBe(
      "example.com/preview?••••",
    );
    expect(redactPreviewUrl("https://example.com/preview?token=abc123#secret=abc123")).toBe(
      "example.com/preview?••••#secret=••••",
    );
  });

  test("fullscreen hook does not log or display raw preview URL", () => {
    const src = read("screens/PreviewFullscreenScreen/hooks/usePreviewFullscreen.ts");
    expect(src).toContain("redactPreviewUrl(url)");
    expect(src).not.toMatch(/console\.warn\([^)]*\{\s*url\s*,\s*error\s*\}/s);
    expect(src).not.toContain("truncateUrl(url, 40)");
  });

  test("webview navigation hook does not log raw decision URL", () => {
    const src = read("screens/shared/preview/useWebViewNavigation.ts");
    expect(src).toContain("redactPreviewUrl(decision.url)");
    expect(src).not.toContain("url: decision.url");
    expect(src).not.toContain("truncateUrl(decision.url");
  });

  test("preview screen guards secret sharing behind explicit confirmation dialogs", () => {
    const src = read("screens/PreviewScreen/hooks/usePreviewScreen.ts");
    expect(src).toContain("Secret-Link teilen?");
    expect(src).toContain("Trotzdem kopieren");
    expect(src).toContain("Secret-Link im Browser oeffnen?");
    expect(src).toContain("Nur ueber sichere Kanaele teilen.");
  });

  test("usePreview keeps async writebacks scoped to the originating project request", () => {
    const src = read("hooks/usePreview.ts");
    expect(src).toContain("const canWriteForRequest = () =>");
    expect(src).toContain("activeProjectIdRef.current === requestProjectId");
    expect(src).toContain("setLastPreview: scopedSetLastPreview");
  });
});
