import {
  sanitizeErrorText,
  sanitizeSecretsInText,
  sanitizeUnknownForTransport,
} from "../supabase/functions/_shared/errorSanitization";

function asRecord(value: unknown): Record<string, unknown> {
  expect(value).not.toBeNull();
  expect(typeof value).toBe("object");
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  expect(Array.isArray(value)).toBe(true);
  return value as unknown[];
}

describe("supabase edge error sanitization", () => {
  test("sanitizeErrorText redacts bearer tokens", () => {
    const inText = "Authorization: Bearer abc.def.ghi";
    const outText = sanitizeErrorText(inText);
    expect(outText).not.toContain("abc.def.ghi");
    expect(outText).toContain("[REDACTED_SECRET]");
  });

  test("sanitizeErrorText redacts GitHub tokens", () => {
    const inText = "oops ghp_1234567890abcdef1234567890abcdef12345678";
    const outText = sanitizeErrorText(inText);
    expect(outText).not.toContain("ghp_1234567890abcdef");
    expect(outText).toContain("[REDACTED_TOKEN]");
  });

  test("sanitizeSecretsInText redacts header/query/assignment style secrets", () => {
    const inText = [
      "authorization: Bearer abc.def.ghi",
      "x-api-key=supersecret",
      "https://example.test/cb?access_token=abc123&safe=1",
      "password: hunter2",
    ].join("\n");

    const outText = sanitizeSecretsInText(inText);
    expect(outText).not.toContain("abc.def.ghi");
    expect(outText).not.toContain("supersecret");
    expect(outText).not.toContain("abc123");
    expect(outText).not.toContain("hunter2");
    expect(outText).toContain("[REDACTED_SECRET]");
  });

  test("sanitizeSecretsInText redacts entire Authorization/Cookie header values", () => {
    const inText = [
      "Authorization: Basic dXNlcjpwYXNz",
      "cookie: a=1; session=secret; theme=dark",
    ].join("\n");

    const outText = sanitizeSecretsInText(inText);
    expect(outText).toContain("Authorization: [REDACTED_SECRET]");
    expect(outText).toContain("cookie: [REDACTED_SECRET]");
    expect(outText).not.toContain("dXNlcjpwYXNz");
    expect(outText).not.toContain("session=secret");
  });

  test("sanitizeSecretsInText does not leak values containing colons", () => {
    const inText = "password=abc:def";
    const outText = sanitizeSecretsInText(inText);
    expect(outText).toBe("password=[REDACTED_SECRET]");
    expect(outText).not.toContain("abc:def");
  });

  test("sanitizeUnknownForTransport walks objects/arrays", () => {
    const inObj = {
      ok: false,
      message: "Bearer top.secret.value",
      nested: {
        arr: ["ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 123, true],
      },
    };
    const outObj = asRecord(sanitizeUnknownForTransport(inObj));
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
    const outObj = asRecord(sanitizeUnknownForTransport(inObj));
    const nested = asRecord(outObj.nested);

    expect(outObj.token).toBe("[REDACTED_SECRET]");
    expect(outObj.authorization).toBe("[REDACTED_SECRET]");
    expect(nested.apiKey).toBe("[REDACTED_SECRET]");
    expect(nested.service_role_key).toBe("[REDACTED_SECRET]");
    expect(nested.ok).toBe("still-ok");
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
    const outObj = asRecord(sanitizeUnknownForTransport(inObj));
    const events = asArray(outObj.events);
    const first = asRecord(events[0]);
    const second = asRecord(events[1]);
    const nestedEvents = asArray(events[2]);
    const nestedFirst = asRecord(nestedEvents[0]);
    const nestedSecond = asRecord(nestedEvents[1]);
    const nestedThird = asRecord(nestedEvents[2]);

    expect(outObj.ok).toBe(true);
    expect(first.token).toBe("[REDACTED_SECRET]");
    expect(second.authorization).toBe("[REDACTED_SECRET]");
    expect(nestedFirst.api_key).toBe("[REDACTED_SECRET]");
    expect(nestedSecond.serviceRoleKey).toBe("[REDACTED_SECRET]");
    expect(nestedThird.password).toBe("[REDACTED_SECRET]");
  });
});
