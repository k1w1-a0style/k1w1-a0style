import { errorResponse } from "../supabase/functions/_shared/cors";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Response is not a JSON object: ${JSON.stringify(value)}`);
  }
  return value as JsonRecord;
}

async function readJsonRecord(res: Response): Promise<JsonRecord> {
  const txt = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(txt);
  } catch {
    throw new Error(`Response is not JSON: ${txt}`);
  }
  return asRecord(parsed);
}

describe("Supabase Edge errorResponse contract", () => {
  it("returns expected JSON shape + status + CORS headers", async () => {
    const req = new Request("http://localhost/test", {
      headers: { origin: "http://localhost" },
    });

    const res = errorResponse("Bad Request", req, 400, { ok: false });
    expect(res.status).toBe(400);

    const allowOrigin = res.headers.get("access-control-allow-origin");
    expect(allowOrigin).toBeTruthy();

    const body = await readJsonRecord(res);
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
        [{ api_key: "k2" }, { serviceRoleKey: "srk" }, { password: "pw" }, { cookie: "session=xyz" }],
      ],
    };

    const res = errorResponse("fail", req, 500, details);
    const body = await readJsonRecord(res);

    expect(body.ok).toBe(false);
    expect(body.error).toBe("fail");
    expect(body.details).toBeTruthy();

    const sanitizedDetails = body.details as {
      token: string;
      authorization: string;
      nested: Array<unknown>;
    };
    const nested0 = sanitizedDetails.nested[0] as { apiKey: string; ok: boolean };
    const nested1 = sanitizedDetails.nested[1] as Array<Record<string, string>>;

    expect(sanitizedDetails.token).toBe("[REDACTED_SECRET]");
    expect(sanitizedDetails.authorization).toBe("[REDACTED_SECRET]");
    expect(nested0.apiKey).toBe("[REDACTED_SECRET]");
    expect(nested1[0].api_key).toBe("[REDACTED_SECRET]");
    expect(nested1[1].serviceRoleKey).toBe("[REDACTED_SECRET]");
    expect(nested1[2].password).toBe("[REDACTED_SECRET]");
    expect(nested1[3].cookie).toBe("[REDACTED_SECRET]");

    const raw = JSON.stringify(body);
    expect(raw).not.toContain("abc123");
    expect(raw).not.toContain("abc.def.ghi");
    expect(raw).not.toContain("srk");
    expect(raw).not.toContain("session=xyz");
  });

  it("sanitizes error text patterns (JWT/Bearer/GitHub tokens)", async () => {
    const req = new Request("http://localhost/test", {
      headers: { origin: "http://localhost" },
    });
    const res = errorResponse("Bearer abc.def.ghi ghp_1234567890abcdef", req, 400);
    const body = await readJsonRecord(res);

    expect(body.error).not.toContain("abc.def.ghi");
    expect(body.error).not.toContain("ghp_");
    expect(body.error).toContain("[REDACTED");
  });
});
