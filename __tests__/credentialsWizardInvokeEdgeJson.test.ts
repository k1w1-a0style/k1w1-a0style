import fs from "fs";
import path from "path";
import { invokeEdgeJson } from "../screens/CredentialsWizardScreen/hooks/credentialHelpers";

describe("CredentialsWizard invokeEdgeJson contract mapping", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("maps HTTP 200 + {ok:false,error} payloads to error branch", async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ ok: false, error: "Missing SIGNING_MASTER_KEY" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ) as unknown as typeof fetch;

    const res = await invokeEdgeJson(
      "https://example.supabase.co",
      "android-keystore-generate",
      "admin-key-12345678901234567890",
      { repo: "owner/repo", mode: "production" },
    );

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("Missing SIGNING_MASTER_KEY");
  });

  test("keeps normal HTTP 200 success payloads as success branch", async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ ok: true, exists: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ) as unknown as typeof fetch;

    const res = await invokeEdgeJson(
      "https://example.supabase.co",
      "android-keystore-status",
      "admin-key-12345678901234567890",
      { repo: "owner/repo", mode: "production" },
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({ ok: true, exists: true });
  });

  test("credentials wizard uses centralized supabase function constants", () => {
    const root = process.cwd();
    const wizard = fs.readFileSync(path.join(root, "screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts"), "utf8");

    expect(wizard).toContain("SUPABASE_EDGE_FUNCTIONS.ANDROID_KEYSTORE_STATUS");
    expect(wizard).toContain("SUPABASE_EDGE_FUNCTIONS.ANDROID_KEYSTORE_GENERATE");
    expect(wizard).not.toContain('"android-keystore-status"');
    expect(wizard).not.toContain('"android-keystore-generate"');
  });

});
