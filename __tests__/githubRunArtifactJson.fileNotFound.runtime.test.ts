import { fileNotFoundInArtifactZipResponse } from "../supabase/functions/github-run-artifact-json/responseContracts";

describe("github-run-artifact-json file-not-found response contract", () => {
  it("returns 404 with bounded details.availableFiles and no top-level code", async () => {
    const req = new Request("https://example.test/functions/v1/github-run-artifact-json", {
      method: "POST",
      headers: { origin: "https://k1w1.app", "content-type": "application/json" },
    });

    const availableFiles = Array.from({ length: 62 }, (_, i) => `logs/file-${i + 1}.json`);
    const res = fileNotFoundInArtifactZipResponse({
      req,
      filePath: "ci-logs/ci-lite-result.json",
      runId: 12345,
      artifact: { id: 777, name: "ci-lite-logs" },
      availableFiles,
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as {
      ok?: boolean;
      error?: string;
      code?: unknown;
      details?: {
        runId?: number;
        artifactId?: number;
        artifactName?: string;
        availableFiles?: string[];
      };
    };

    expect(body.ok).toBe(false);
    expect(body.error).toBe("File not found in artifact zip: ci-logs/ci-lite-result.json");
    expect(body.code).toBeUndefined();
    expect(body.details).toBeTruthy();
    expect(body.details?.runId).toBe(12345);
    expect(body.details?.artifactId).toBe(777);
    expect(body.details?.artifactName).toBe("ci-lite-logs");
    expect(Array.isArray(body.details?.availableFiles)).toBe(true);
    expect(body.details?.availableFiles).toHaveLength(50);
    expect(body.details?.availableFiles?.[0]).toBe("logs/file-1.json");
    expect(body.details?.availableFiles?.[49]).toBe("logs/file-50.json");
  });
});
