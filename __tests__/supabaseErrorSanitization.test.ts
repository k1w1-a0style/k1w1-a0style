import {
  sanitizeErrorText,
  sanitizeUnknownForTransport,
} from "../supabase/functions/_shared/errorSanitization";

describe("supabase edge error sanitization", () => {
  test("sanitizeErrorText redacts bearer tokens", () => {
    const inText = "Authorization: Bearer abc.def.ghi";
    const outText = sanitizeErrorText(inText);
    expect(outText).not.toContain("abc.def.ghi");
    expect(outText).toContain("[REDACTED_TOKEN]");
  });

  test("sanitizeErrorText redacts GitHub tokens", () => {
    const inText = "oops ghp_1234567890abcdef1234567890abcdef12345678";
    const outText = sanitizeErrorText(inText);
    expect(outText).not.toContain("ghp_1234567890abcdef");
    expect(outText).toContain("[REDACTED_TOKEN]");
  });

  test("sanitizeUnknownForTransport walks objects/arrays", () => {
    const inObj = {
      ok: false,
      message: "Bearer top.secret.value",
      nested: {
        arr: ["ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 123, true],
      },
    };
    const outObj = sanitizeUnknownForTransport(inObj) as any;
    expect(JSON.stringify(outObj)).not.toContain("top.secret.value");
    expect(JSON.stringify(outObj)).toContain("[REDACTED_TOKEN]");
  });
});
