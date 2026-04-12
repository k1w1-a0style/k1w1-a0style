import { errorResponse, jsonResponse } from "../supabase/functions/_shared/cors";

describe("cors no-store response option", () => {
  const req = new Request("https://example.test", {
    headers: { origin: "https://k1w1.app" },
  });

  it("sets strict no-store headers for jsonResponse when requested", () => {
    const res = jsonResponse({ ok: true }, req, 200, { noStore: true });
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/i);
    expect(res.headers.get("Pragma")).toBe("no-cache");
    expect(res.headers.get("Expires")).toBe("0");
  });

  it("sets strict no-store headers for errorResponse when requested", () => {
    const res = errorResponse("x", req, 500, undefined, { noStore: true });
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/i);
    expect(res.headers.get("Pragma")).toBe("no-cache");
    expect(res.headers.get("Expires")).toBe("0");
  });
});
