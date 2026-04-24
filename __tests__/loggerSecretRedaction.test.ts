import { logger } from "../lib/logger";

describe("logger central secret redaction", () => {
  const infoSpy = jest.spyOn(console, "info").mockImplementation(() => undefined);
  const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

  afterEach(() => {
    infoSpy.mockClear();
    warnSpy.mockClear();
    errorSpy.mockClear();
  });

  afterAll(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test("redacts bearer and PAT patterns before console sink", () => {
    logger.info(
      "Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345",
      "token=ghp_abcdefghijklmnopqrstuvwxyz1234567890",
      "project=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890"
    );

    const output = infoSpy.mock.calls[0]?.map((part) => String(part)).join(" ") ?? "";
    expect(output).toContain("Bearer <redacted>");
    expect(output).toContain("<redacted>");
    expect(output).not.toContain("abcdefghijklmnopqrstuvwxyz012345");
    expect(output).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz1234567890");
    expect(output).not.toContain("sk-proj-abcdefghijklmnopqrstuvwxyz1234567890");
  });

  test("redacts nested sensitive metadata keys but keeps harmless fields", () => {
    logger.warn("debug payload", {
      status: "running",
      sessionToken: "session-secret-value",
      nested: {
        apiKey: "sk-ant-api03-abcdefghijklmnopqrstuvwxyz",
        label: "safe",
      },
    });

    const payload = warnSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.status).toBe("running");
    expect(payload.sessionToken).toBe("<redacted>");
    const nested = payload.nested as Record<string, unknown>;
    expect(nested.apiKey).toBe("<redacted>");
    expect(nested.label).toBe("safe");
  });

  test("redacts Error message/stack while keeping object usable", () => {
    const err = new Error("request failed: Authorization: Bearer this-should-not-leak");
    err.stack = "Error: request failed\n at run (token=hf_abcdefghijklmnopqrstuvwxyz1234567890)";

    logger.error("operation failed", { err });

    const payload = errorSpy.mock.calls[0]?.[1] as { err: Error };
    expect(payload.err.message).toContain("Bearer <redacted>");
    expect(payload.err.message).not.toContain("this-should-not-leak");
    expect(String(payload.err.stack)).toContain("<redacted>");
    expect(String(payload.err.stack)).not.toContain("hf_abcdefghijklmnopqrstuvwxyz1234567890");
  });

  test("keeps harmless text readable", () => {
    const msg = "status: waiting for retry";
    logger.info(msg);
    expect(infoSpy.mock.calls[0]?.[0]).toBe(msg);
  });
});
