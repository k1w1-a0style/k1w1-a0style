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

  test("sanitizeUnknownForTransport redacts sensitive keys even for short values", () => {
    const inObj = {
      token: "abc123",
      authorization: "Bearer short.token",
      nested: {
        apiKey: "k1w1",
        service_role_key: "srk",
        ok: "still-ok",
      },
    };
    const outObj = sanitizeUnknownForTransport(inObj) as any;
    expect(outObj.token).toBe("[REDACTED_SECRET]");
    expect(outObj.authorization).toBe("[REDACTED_SECRET]");
    expect(outObj.nested.apiKey).toBe("[REDACTED_SECRET]");
    expect(outObj.nested.service_role_key).toBe("[REDACTED_SECRET]");
    expect(outObj.nested.ok).toBe("still-ok");
  });

  test("sanitizeUnknownForTransport redacts sensitive keys inside nested arrays", () => {
    const inObj = {
      ok: true,
      events: [
        { type: "auth", token: "abc123" },
        { type: "headers", authorization: "Bearer abc.def.ghi" },
        [
          { api_key: "short" },
          { serviceRoleKey: "srk" },
          { password: "p" },
        ],
      ],
    };
    const outObj = sanitizeUnknownForTransport(inObj) as any;

    expect(outObj.ok).toBe(true);
    expect(outObj.events[0].token).toBe("[REDACTED_SECRET]");
    expect(outObj.events[1].authorization).toBe("[REDACTED_SECRET]");
    expect(outObj.events[2][0].api_key).toBe("[REDACTED_SECRET]");
    expect(outObj.events[2][1].serviceRoleKey).toBe("[REDACTED_SECRET]");
    expect(outObj.events[2][2].password).toBe("[REDACTED_SECRET]");
  });
});
