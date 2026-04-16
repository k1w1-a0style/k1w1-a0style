import { sanitizeDebugSearchQuery } from "../screens/TerminalScreen/hooks/terminalHelpers";

describe("terminal export hygiene", () => {
  test("redacts sensitive token-like search query before debug export metadata serialization", () => {
    const raw = "Authorization: Bearer secret_token_1234567890";
    const out = sanitizeDebugSearchQuery(raw);
    expect(out).toContain("Bearer <redacted>");
    expect(out).not.toContain("secret_token_1234567890");
  });

  test("truncates long search query metadata to bounded length", () => {
    const out = sanitizeDebugSearchQuery("x".repeat(1_000));
    expect(out.length).toBeLessThanOrEqual(120);
  });
});
