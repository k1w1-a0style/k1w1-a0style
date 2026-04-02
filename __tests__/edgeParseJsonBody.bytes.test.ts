import { parseJsonBody } from "../supabase/functions/_shared/validation";

describe("parseJsonBody byte limits", () => {
  it("rejects multibyte payloads by actual byte length", async () => {
    const multibyte = "ä".repeat(40);
    const req = new Request("https://example.test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: multibyte }),
    });

    const res = await parseJsonBody(req, 50);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("too large");
  });
});
