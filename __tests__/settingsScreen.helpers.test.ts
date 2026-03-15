import {
  getProviderStatusSnapshot,
  validateApiKeyInput,
} from "../screens/SettingsScreen/hooks/settingsHelpers";

describe("Settings helpers", () => {
  test("validateApiKeyInput enforces Gemini AIza prefix", () => {
    expect(validateApiKeyInput("gemini", "not-a-gemini-key-1234567890")).toContain("AIza");
    expect(validateApiKeyInput("gemini", "AIzaSyA12345678901234567890")).toBeNull();
  });

  test("getProviderStatusSnapshot supports array shape and normalizes flags", () => {
    const status = getProviderStatusSnapshot(
      [{ provider: "openai", status: "rate_limited", message: "quota" }],
      "openai",
    );

    expect(status.status).toBe("rate_limited");
    expect(status.limitReached).toBe(true);
    expect(status.message).toBe("quota");
  });

  test("getProviderStatusSnapshot supports record shape with id + lastRotation", () => {
    const now = new Date().toISOString();
    const status = getProviderStatusSnapshot(
      {
        groq: {
          id: "groq",
          status: "ok",
          lastRotation: now,
        },
      },
      "groq",
    );

    expect(status.status).toBe("ok");
    expect(status.limitReached).toBe(false);
    expect(status.lastRotation).toBe(now);
  });
});
