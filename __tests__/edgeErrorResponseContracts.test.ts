import { errorResponse } from "../supabase/functions/_shared/cors";

async function readJson(res: Response): Promise<any> {
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch {
    throw new Error(`Response is not JSON: ${txt}`);
  }
}

describe("Supabase Edge errorResponse contract", () => {
  it("returns expected JSON shape + status + CORS headers", async () => {
    const req = new Request("http://localhost/test", {
      headers: { origin: "http://localhost" },
    });

    const res = errorResponse("Bad Request", req, 400, { ok: false });
    expect(res.status).toBe(400);

    // Basic CORS header should exist (value depends on allowlist logic)
    const allowOrigin = res.headers.get("access-control-allow-origin");
    expect(allowOrigin).toBeTruthy();

    const body = await readJson(res);
    expect(body).toHaveProperty("ok", false);
    expect(body).toHaveProperty("error", "Bad Request");
    expect(body).toHaveProperty("details");
    expect(body.details).toEqual({ ok: false });
  });

  it("redacts sensitive keys inside details (including nested arrays/objects)", async () => {
    const req = new Request("http://localhost/test", {
      headers: { origin: "http://localhost" },
    });

    const details = {
      token: "abc123",
      authorization: "Bearer abc.def.ghi",
      nested: [
        { apiKey: "k1", ok: true },
        [
          { serviceRoleKey: "srk" },
          { password: "pw" },
          { cookie: "session=xyz" },
        ],
      ],
    };

    const res = errorResponse("fail", req, 500, details);
    const body = await readJson(res);

    // shape
    expect(body.ok).toBe(false);
    expect(body.error).toBe("fail");
    expect(body.details).toBeTruthy();

    // redactions
    expect(body.details.token).toBe("[REDACTED_SECRET]");
    expect(body.details.authorization).toBe("[REDACTED_SECRET]");
    expect(body.details.nested[0].apiKey).toBe("[REDACTED_SECRET]");
    expect(body.details.nested[1][0].serviceRoleKey).toBe("[REDACTED_SECRET]");
    expect(body.details.nested[1][1].password).toBe("[REDACTED_SECRET]");
    expect(body.details.nested[1][2].cookie).toBe("[REDACTED_SECRET]");

    // ensure raw secrets do not appear anywhere in serialized response
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("abc123");
    expect(raw).not.toContain("Bearer");
    expect(raw).not.toContain("srk");
    expect(raw).not.toContain("session=xyz");
  });

  it("sanitizes error text patterns (JWT/Bearer/GitHub tokens)", async () => {
    const req = new Request("http://localhost/test", {
      headers: { origin: "http://localhost" },
    });
    const res = errorResponse("Bearer abc.def.ghi ghp_1234567890abcdef", req, 400);
    const body = await readJson(res);
    expect(body.error).not.toContain("Bearer");
    expect(body.error).not.toContain("ghp_");
    expect(body.error).toContain("[REDACTED_SECRET]");
  });
});
