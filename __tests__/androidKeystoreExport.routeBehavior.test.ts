import {
  __unsafeEncryptWithAesGcmLegacyV2ForTests,
  decryptKeystorePayloadWithMigration,
} from "../supabase/functions/_shared/androidKeystoreCrypto";

type CapturedHandler = (req: Request) => Promise<Response>;

describe("android-keystore-export route behavior", () => {
  const masterKey = "test-signing-master-key-0123456789";

  async function runExportRouteWithStoredCiphertext(storedCiphertext: string): Promise<{
    response: Response;
    uploadSpy: jest.Mock;
  }> {
    jest.resetModules();

    const uploadSpy = jest.fn(async () => ({ error: null }));
    const downloadSpy = jest.fn(async () => ({
      data: {
        text: async () => storedCiphertext,
      },
      error: null,
    }));
    const auditInsertSpy = jest.fn(async () => ({ error: null }));

    const fromSigningAndroid = {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => ({
              data: {
                repo: "owner/name",
                alias: "upload",
                storage_bucket: "bucket",
                storage_path: "keystore.enc",
              },
              error: null,
            })),
          })),
        })),
      })),
    };

    const supabaseClient = {
      from: jest.fn((table: string) => {
        if (table === "signing_android") return fromSigningAndroid;
        if (table === "signing_audit_log") {
          return {
            insert: auditInsertSpy,
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
      storage: {
        from: jest.fn(() => ({
          download: downloadSpy,
          upload: uploadSpy,
        })),
      },
    };

    const errorResponse = (message: string, _req: Request, status: number, details?: unknown) =>
      new Response(JSON.stringify({ error: message, details }), { status });
    const jsonResponse = (body: unknown, _req: Request, status = 200) =>
      new Response(JSON.stringify(body), { status });

    jest.doMock("../supabase/functions/android-keystore-export/helpers.ts", () => ({
      createClient: jest.fn(() => supabaseClient),
      decryptKeystorePayloadWithMigration,
      errorResponse,
      getServiceRoleKey: jest.fn(() => "service-role-key"),
      getSigningMasterKey: jest.fn(() => masterKey),
      getSupabaseUrl: jest.fn(() => "https://example.supabase.co"),
      getRequestClientIp: jest.fn(() => "127.0.0.1"),
      getRequestRateLimitSubject: jest.fn(() => "subject:jwt"),
      handleCors: jest.fn(() => null),
      isAllowedGithubRepo: jest.fn(() => true),
      jsonResponse,
      rateLimit: jest.fn(() => null),
      repoOk: jest.fn(() => true),
      requireDurableRateLimit: jest.fn(async () => null),
      requireScopedEdgeAuth: jest.fn(() => null),
      requireServiceRoleJwtWithVerifiedActor: jest.fn(async () => ({ guard: null, actor: "workflow-actor" })),
      resolveMode: jest.fn(() => "production"),
      safeString: jest.fn((value: unknown) => (typeof value === "string" ? value.trim() : "")),
    }));

    jest.doMock("../supabase/functions/_shared/validation.ts", () => ({
      isParsedJsonBodyError: jest.fn(() => false),
      parseJsonBody: jest.fn(async () => ({
        body: {
          repo: "owner/name",
          mode: "production",
        },
      })),
    }));

    jest.doMock("../supabase/functions/_shared/errorSanitization.ts", () => ({
      sanitizeErrorText: jest.fn((message: string) => message),
    }));

    let capturedHandler: CapturedHandler | null = null;
    (globalThis as { Deno?: { serve: (handler: CapturedHandler) => void } }).Deno = {
      serve: (handler: CapturedHandler) => {
        capturedHandler = handler;
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("../supabase/functions/android-keystore-export/index.ts");

    if (!capturedHandler) {
      throw new Error("android-keystore-export handler was not captured");
    }
    const handler: CapturedHandler = capturedHandler;

    const request = new Request("https://example.test/functions/v1/android-keystore-export", {
      method: "POST",
      body: JSON.stringify({ repo: "owner/name", mode: "production" }),
    });

    const response = await handler(request);
    return { response, uploadSpy };
  }

  it("returns an error and does not persist migration when decrypted legacy payload is invalid JSON", async () => {
    const legacyCiphertext = await __unsafeEncryptWithAesGcmLegacyV2ForTests("not-json", masterKey);

    const { response, uploadSpy } = await runExportRouteWithStoredCiphertext(legacyCiphertext);

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toContain("Decrypted keystore payload is not valid JSON");
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("returns an error and does not persist migration when decrypted legacy payload shape is invalid", async () => {
    const legacyCiphertext = await __unsafeEncryptWithAesGcmLegacyV2ForTests(
      JSON.stringify({ alias: "upload", keystoreBase64: "ZmFrZQ==" }),
      masterKey,
    );

    const { response, uploadSpy } = await runExportRouteWithStoredCiphertext(legacyCiphertext);

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toContain("Decrypted keystore payload has unexpected shape");
    expect(uploadSpy).not.toHaveBeenCalled();
  });
});
