jest.mock("../lib/supabase", () => ({
  ensureSupabaseClient: jest.fn(),
}));

import { ensureSupabaseClient } from "../lib/supabase";
import {
  uploadDiagnosticReport,
} from "../lib/diagnostics/diagnosticUploader";
import type { DiagnosticUploadInput } from "../lib/diagnostics/diagnosticUploader";

const mockEnsureSupabaseClient = ensureSupabaseClient as jest.MockedFunction<typeof ensureSupabaseClient>;

function makeInput(overrides: Partial<DiagnosticUploadInput> = {}): DiagnosticUploadInput {
  return {
    deviceId: "dev_12345678",
    appVersion: "1.2.3",
    projectName: "demo",
    target: { mode: "eas", profile: "preview" },
    checks: [
      {
        id: "diag.ok",
        title: "ok",
        status: "pass",
        severity: "normal",
        message: "fine",
      },
    ],
    projectFiles: [
      {
        path: "package.json",
        content: '{"name":"demo"}',
      },
    ],
    notes: "hello",
    ...overrides,
  };
}

describe("patch506 diagnostic upload client contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps the normal client path on the direct RPC and accepts bigint ids", async () => {
    const rpc = jest.fn(async () => ({ data: 42, error: null }));
    mockEnsureSupabaseClient.mockResolvedValue({ rpc } as never);

    const result = await uploadDiagnosticReport(makeInput({ clientRequestId: "11111111-1111-1111-1111-111111111111" }));

    expect(result).toEqual({ id: "42" });
    expect(rpc).toHaveBeenCalledWith(
      "insert_diagnostic_upload",
      expect.objectContaining({
        payload: expect.objectContaining({
          device_id: "dev_12345678",
          client_request_id: "11111111-1111-1111-1111-111111111111",
          target: "eas:preview",
          project_name: "demo",
          app_version: "1.2.3",
          notes: "hello",
        }),
      }),
    );
  });

  it("keeps client-request-id generation and payload shaping stable for anon client uploads", async () => {
    const rpc = jest.fn(async () => ({
      data: "11111111-1111-1111-1111-111111111111",
      error: null,
    }));
    mockEnsureSupabaseClient.mockResolvedValue({ rpc } as never);

    const result = await uploadDiagnosticReport(makeInput({ clientRequestId: undefined }));

    expect(result?.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(rpc).toHaveBeenCalledWith(
      "insert_diagnostic_upload",
      expect.objectContaining({
        payload: expect.objectContaining({
          client_request_id: expect.any(String),
          summary: {
            counts: { pass: 1, warn: 0, fail: 0 },
            platform: "android",
          },
          snapshots: [
            expect.objectContaining({ path: "package.json", content: expect.stringContaining("\"name\": \"demo\"") }),
          ],
        }),
      }),
    );
  });
});
