import { renderFragmentBootstrapPage } from "../supabase/functions/preview_page/render";

describe("preview fragment bootstrap nonce normalization", () => {
  test("does not embed control character U+0001 and keeps regex backreference", () => {
    const html = renderFragmentBootstrapPage({ nonce: "BOOTSTRAP_NONCE" });
    expect(html.includes("\u0001")).toBe(false);
    expect(Array.from(html).some((c) => c.charCodeAt(0) === 1)).toBe(false);
    expect(html).toContain("const noncePattern = /nonce=([\"']).*?\\1/gi;");
  });

  test("normalizes both single and double quoted script nonce attributes", () => {
    const page = renderFragmentBootstrapPage({ nonce: "BOOTSTRAP_NONCE" });
    const match = page.match(/const noncePattern = \/nonce=\(\["'\]\)\.\*\?\\1\/gi;/);
    expect(match).toBeTruthy();

    const noncePattern = /nonce=(["']).*?\1/gi;
    const input = '<script nonce="FINAL_NONCE"></script><script nonce=\'FINAL_NONCE\'></script>';
    const normalized = input.replace(noncePattern, 'nonce="BOOTSTRAP_NONCE"');

    expect(normalized).toContain('<script nonce="BOOTSTRAP_NONCE"></script>');
    expect(normalized).toContain('<script nonce="BOOTSTRAP_NONCE"></script>');
    expect(normalized).not.toContain('FINAL_NONCE');
  });
});
