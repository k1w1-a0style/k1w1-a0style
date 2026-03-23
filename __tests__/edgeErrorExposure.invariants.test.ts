import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("edge error exposure invariants", () => {
  it("preview_page does not interpolate raw stack/message into overlay HTML", () => {
    const src = read("supabase/functions/preview_page/index.ts");

    expect(src).toContain("function setOverlayState(state, message)");
    expect(src).toContain("body.textContent = sanitizeClientErrorText");
    expect(src).toContain("return previewPageErrorResponse({");
    expect(src).not.toContain("return jsonPreviewError({ code: recordResult.code })");
    expect(src).not.toContain('overlay.innerHTML = `\n      <div class="error-title">Preview Error</div>\n      <div class="error-message">${String(err?.stack || err?.message || err)}</div>\n    `;');
    expect(src).not.toContain("err?.stack");
  });

  it("k1w1-handler returns only structured client-safe errors", () => {
    const indexSrc = read("supabase/functions/k1w1-handler/index.ts");
    const helpersSrc = read("supabase/functions/k1w1-handler/helpers.ts");

    expect(indexSrc).toContain('code: "invalid_request_payload" as const');
    expect(indexSrc).toContain('const errorPayload = classifyK1w1HandlerError(err, {');
    expect(indexSrc).not.toContain('JSON.stringify({ ok: false, error: parsedBody.error })');
    expect(indexSrc).not.toContain('error: err?.message || "Unknown error"');
    expect(indexSrc).toContain('} catch (err: unknown) {');
    expect(helpersSrc).toContain('export type K1w1HandlerErrorCode =');
    expect(helpersSrc).toContain('provider_env_missing');
    expect(helpersSrc).toContain('provider_http_429');
    expect(helpersSrc).toContain('provider_model_not_found');
    expect(helpersSrc).toContain('unknown_internal_error');
  });
});
