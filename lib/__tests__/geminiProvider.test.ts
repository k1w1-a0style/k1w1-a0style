import { callGemini } from "../orchestrator/providers/gemini";

describe("callGemini", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("sends the Gemini API key via header instead of query string", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Hallo zurück" }] } }],
      }),
    });

    global.fetch = fetchMock as typeof fetch;

    const result = await callGemini(
      "AIza-test-secret",
      "gemini-2.5-flash",
      [{ role: "user", content: "Hallo" }],
      "speed",
    );

    expect(result).toEqual({ ok: true, text: "Hallo zurück" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    );
    expect(url).not.toContain("key=");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "x-goog-api-key": "AIza-test-secret",
    });
  });
});
