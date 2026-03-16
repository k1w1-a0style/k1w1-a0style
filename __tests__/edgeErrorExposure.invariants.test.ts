import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("edge error exposure invariants", () => {
  it("preview_page does not interpolate raw stack/message into overlay HTML", () => {
    const src = read("supabase/functions/preview_page/index.ts");

    expect(src).toContain("function setOverlayState(state, message)");
    expect(src).toContain("body.textContent = sanitizeClientErrorText");
    expect(src).not.toContain('overlay.innerHTML = `\n      <div class="error-title">Preview Error</div>\n      <div class="error-message">${String(err?.stack || err?.message || err)}</div>\n    `;');
    expect(src).not.toContain("err?.stack");
  });

  it("k1w1-handler returns only generic client-safe errors", () => {
    const src = read("supabase/functions/k1w1-handler/index.ts");

    expect(src).toContain('error: isTooLarge ? "Request too large." : "Invalid request payload."');
    expect(src).not.toContain('JSON.stringify({ ok: false, error: parsedBody.error })');
    expect(src).toContain('error: isValidationError');
    expect(src).toContain('"Invalid request payload."');
    expect(src).toContain('"Internal Server Error"');
    expect(src).not.toContain('error: err?.message || "Unknown error"');
    expect(src).toContain('} catch (err: unknown) {');
  });
});
