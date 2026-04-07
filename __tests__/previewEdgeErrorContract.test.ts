import fs from "fs";
import path from "path";
import {
  classifySavePreviewPayloadError,
  classifySavePreviewUnexpectedError,
  jsonPreviewError as jsonSavePreviewError,
} from "../supabase/functions/save_preview/helpers";
import {
  buildPreviewSecretCandidates,
  classifyPreviewPageUnexpectedError,
  classifyPreviewRecordLookupFailure,
  htmlPreviewError,
  previewPageErrorResponse,
} from "../supabase/functions/preview_page/helpers";
import {
  describeRemotePreviewFailure,
  invokeSavePreview,
} from "../hooks/previewHelpers";

describe("preview edge error contract", () => {
  const originalFetch = global.fetch;
  const originalSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.EXPO_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    jest.resetAllMocks();
  });

  it("returns a structured env-missing error for save_preview server configuration gaps", async () => {
    const res = jsonSavePreviewError({
      origin: "https://app.example.com",
      code: "preview_env_missing",
    });

    expect(res.status).toBe(500);
    expect(res.headers.get("x-k1w1-preview-error")).toBe("preview_env_missing");
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      code: "preview_env_missing",
      error: expect.stringContaining("konfiguriert"),
    });
  });

  it("classifies invalid or empty preview payloads without falling back to generic 500", () => {
    expect(classifySavePreviewPayloadError("No valid files")).toBe("preview_payload_invalid");
    expect(classifySavePreviewPayloadError("Invalid JSON: body must be a JSON object")).toBe(
      "preview_payload_invalid",
    );
    expect(classifySavePreviewPayloadError("Body too large (2000000 > 1500000)")).toBe(
      "preview_payload_too_large",
    );
  });

  it("classifies preview DB insert/select failures as preview_db_error", () => {
    expect(
      classifySavePreviewUnexpectedError(new Error('duplicate key value violates unique constraint "previews_pkey"')),
    ).toBe("preview_db_error");
    expect(classifyPreviewRecordLookupFailure({ status: 500 })).toBe("preview_db_error");
    expect(classifyPreviewRecordLookupFailure({ parseFailed: true, error: new Error("bad json") })).toBe(
      "preview_db_error",
    );
  });

  it("keeps preview_page lookup config guards ahead of the fetch timeout allocation", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "supabase/functions/preview_page/index.ts"),
      "utf8",
    );

    const fetchPreviewRecordSource = source.slice(
      source.indexOf("async function fetchPreviewRecord"),
      source.indexOf("async function deletePreviewRecord"),
    );

    expect(fetchPreviewRecordSource.indexOf("headers = supabaseHeaders();")).toBeGreaterThan(-1);
    expect(fetchPreviewRecordSource.indexOf("fetchWithTimeout(restUrl")).toBeGreaterThan(-1);
    expect(fetchPreviewRecordSource).toContain("findFirstByPreviewSecretCandidates<PreviewRecord[]>");
    expect(fetchPreviewRecordSource).toContain("async (candidate) => {");
    expect(fetchPreviewRecordSource.indexOf("headers = supabaseHeaders();")).toBeLessThan(
      fetchPreviewRecordSource.indexOf("fetchWithTimeout(restUrl"),
    );
  });

  it("classifies preview_page partial preview env as preview_env_missing", () => {
    expect(
      classifyPreviewRecordLookupFailure({
        missingServiceRoleKey: true,
      }),
    ).toBe("preview_env_missing");
  });

  it("keeps preview save/page secret transport on fragment + header handoff (no query secret default)", () => {
    const savePreviewSource = fs.readFileSync(
      path.join(process.cwd(), "supabase/functions/save_preview/index.ts"),
      "utf8",
    );
    const previewPageSource = fs.readFileSync(
      path.join(process.cwd(), "supabase/functions/preview_page/index.ts"),
      "utf8",
    );

    expect(savePreviewSource).toContain("/functions/v1/preview_page?transport=fragment");
    expect(savePreviewSource).toContain("#secret=${encodeURIComponent(secret)}");
    expect(savePreviewSource).toContain("hashPreviewSecret(secret)");
    expect(previewPageSource).toContain('const headerSecret = req.headers.get("x-k1w1-preview-secret") ?? ""');
    expect(previewPageSource).toContain("findFirstByPreviewSecretCandidates<PreviewRecord[]>");
    expect(previewPageSource).toContain("deleteByPreviewSecretCandidates(secret");
    expect(previewPageSource).not.toContain("const querySecret =");
    expect(previewPageSource).not.toContain("renderLegacyQuerySecretBridgePage");
    expect(previewPageSource).not.toContain('current.searchParams.delete("secret")');
    expect(previewPageSource).toContain("renderFragmentBootstrapPage");
    expect(previewPageSource).toContain('if (req.method !== "GET" && req.method !== "HEAD")');
    expect(previewPageSource).toContain("function isValidPreviewSecret(secret: string)");
    expect(previewPageSource).toContain("if (!isValidPreviewSecret(secret)) {");
    expect(previewPageSource).toContain("Missing preview secret header.");
    expect(previewPageSource).toContain('code: "preview_payload_invalid"');
    expect(previewPageSource).not.toContain("preview_invalid_payload");
  });

  it("builds secret candidates as hash-first with raw-secret fallback for legacy compatibility", async () => {
    const candidates = await buildPreviewSecretCandidates("abc123-preview-secret");
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatch(/^psh_v1_/);
    expect(candidates[1]).toBe("abc123-preview-secret");
  });

  it("keeps expiry cleanup compatible with hashed and legacy raw preview rows", () => {
    const previewPageSource = fs.readFileSync(
      path.join(process.cwd(), "supabase/functions/preview_page/index.ts"),
      "utf8",
    );

    const deleteSource = previewPageSource.slice(
      previewPageSource.indexOf("async function deletePreviewRecord"),
      previewPageSource.indexOf("function isExpired"),
    );

    expect(deleteSource).toContain("deleteByPreviewSecretCandidates(secret");
    expect(deleteSource).toContain("async (candidate) =>");
    expect(deleteSource).toContain("secret=eq.${encodeURIComponent(candidate)}");
  });

  it("classifies preview_page runtime catch failures explicitly and keeps the response safe", async () => {
    expect(classifyPreviewPageUnexpectedError(new Error("render failed"))).toBe("preview_runtime_error");

    const res = htmlPreviewError({
      code: "preview_runtime_error",
      nonce: "nonce-123",
      title: "Preview Error",
      message: "Preview konnte serverseitig nicht gerendert werden.",
    });

    expect(res.status).toBe(500);
    expect(res.headers.get("x-k1w1-preview-error")).toBe("preview_runtime_error");
    await expect(res.text()).resolves.toContain('data-preview-error-code="preview_runtime_error"');
  });

  it("keeps preview_page browser-facing lookup/env/db failures on the HTML error path with structured markers", async () => {
    const envRes = previewPageErrorResponse({
      code: "preview_env_missing",
      nonce: "nonce-env",
    });
    const dbRes = previewPageErrorResponse({
      code: "preview_db_error",
      nonce: "nonce-db",
    });

    expect(envRes.status).toBe(500);
    expect(envRes.headers.get("content-type")).toContain("text/html");
    expect(envRes.headers.get("x-k1w1-preview-error")).toBe("preview_env_missing");
    await expect(envRes.text()).resolves.toContain('data-preview-error-code="preview_env_missing"');

    expect(dbRes.status).toBe(502);
    expect(dbRes.headers.get("content-type")).toContain("text/html");
    expect(dbRes.headers.get("x-k1w1-preview-error")).toBe("preview_db_error");
    await expect(dbRes.text()).resolves.toContain('data-preview-error-code="preview_db_error"');
  });

  it("reads structured preview edge errors in invokeSavePreview and maps them to honest client copy", async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://preview.example.com";
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () =>
        JSON.stringify({
          ok: false,
          code: "preview_db_error",
          error: "Preview konnte serverseitig nicht verarbeitet werden.",
        }),
    }) as unknown as typeof fetch;

    await expect(
      invokeSavePreview({
        bearerJwt: "preview-user-jwt-token",
        payload: {
          name: "Preview",
          files: { "/App.tsx": { contents: "export default function App() { return null; }" } },
          dependencies: {},
          meta: {},
        },
      }),
    ).rejects.toMatchObject({
      status: 502,
      code: "preview_db_error",
      message: "Preview konnte serverseitig nicht verarbeitet werden.",
    });

    const clientMessage = describeRemotePreviewFailure({
      bearerJwt: "preview-user-jwt-token",
      statusCode: 502,
      error: Object.assign(new Error("Preview konnte serverseitig nicht verarbeitet werden."), {
        code: "preview_db_error",
      }),
    });

    expect(clientMessage).toBe(
      "Remote-Preview konnte serverseitig nicht gespeichert oder geladen werden.",
    );
  });

  it("maps nested response preview error codes to contract copy", () => {
    const clientMessage = describeRemotePreviewFailure({
      bearerJwt: "preview-user-jwt-token",
      statusCode: 502,
      error: {
        response: {
          code: "preview_db_error",
        },
      },
    });

    expect(clientMessage).toBe(
      "Remote-Preview konnte serverseitig nicht gespeichert oder geladen werden.",
    );
  });
});
