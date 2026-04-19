import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  getRequestRateLimitSubject,
  requireDurableRateLimit,
  requireWorkflowOperatorJwtRole,
  requireScopedEdgeAuth,
  rateLimit,
} from "../_shared/auth.ts";
import { githubFetchJson, githubFetchRaw, getGithubToken, isAllowedGithubRepo } from "../_shared/github.ts";
import { isParsedJsonBodyError, isSafeGitHubRepoFullName, parseJsonBody } from "../_shared/validation.ts";
import { sanitizeErrorText } from "../_shared/errorSanitization.ts";

// GitHub Artifacts are delivered as ZIP. The Deno std ZIP module moved around and
// is often blocked by edge bundlers. Use a small, bundler-friendly unzipper.
import { unzipSync, strFromU8 } from "https://esm.sh/fflate@0.8.2?deno";

type ReqBody = {
  githubRepo: string; // "owner/repo"
  runId: number;
  artifactName: string; // e.g. "ci-lite-logs"
  filePath: string; // e.g. "ci-logs/ci-lite-result.json"
  workflow?: string;
};

type Artifact = {
  id: number;
  name: string;
  archive_download_url: string;
  expired: boolean;
};

const MAX_ARTIFACT_ARCHIVE_BYTES = 10 * 1024 * 1024;
const MAX_RESPONSE_TEXT_BYTES = 1024 * 1024;

function normalizeZipPath(p: string): string {
  return p.replace(/^\.\//, "").replace(/\\/g, "/");
}

function pickFileFromZip(files: Record<string, Uint8Array>, wanted: string): Uint8Array | null {
  const target = normalizeZipPath(wanted);
  if (files[target]) return files[target];
  const keys = Object.keys(files);
  const suffixMatch = keys.find((k) => normalizeZipPath(k).endsWith("/" + target) || normalizeZipPath(k) === target);
  if (suffixMatch) return files[suffixMatch];
  return null;
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Legacy guard lineage: generic admin key / admin-or-CI bearer guards (removed).
  const authError = requireScopedEdgeAuth(req, {
    scope: "github-run-artifact-json",
    allowAdmin: true,
    adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
  });
  if (authError) return authError;
  const jwtRoleGuard = await requireWorkflowOperatorJwtRole(req, "github-run-artifact-json");
  if (jwtRoleGuard) return jwtRoleGuard;

    const durableRl = await requireDurableRateLimit(req, {
      scope: "github-run-artifact-json",
      subject: getRequestRateLimitSubject(req),
      max: 30,
      windowMs: 60_000,
    });
    if (durableRl) return durableRl;

  const rl = rateLimit(req, "github-run-artifact-json", 30, 60_000);
  if (rl) return rl;

  try {
    const secureError = (message: string, status: number, details?: unknown) =>
      errorResponse(message, req, status, details, { noStore: true });
    const token = getGithubToken();
    if (!token) {
      return secureError("Missing GitHub token for artifact lookup", 500);
    }

    const parsedBody = await parseJsonBody(req, 20_000);
    if (isParsedJsonBodyError(parsedBody)) {
      const status = parsedBody.error.toLowerCase().includes("too large") ? 413 : 400;
      return secureError(status === 413 ? "Request too large" : "Invalid JSON body", status);
    }

    const body = parsedBody.body as ReqBody;
    const { githubRepo, runId, artifactName, filePath } = body;

    if (!isSafeGitHubRepoFullName(githubRepo)) {
      return secureError("Invalid githubRepo", 400);
    }
    if (!isAllowedGithubRepo(githubRepo)) {
      return errorResponse("githubRepo not allowed", req, 403, { githubRepo }, {
        noStore: true,
      });
    }
    if (!Number.isFinite(runId) || runId <= 0) {
      return secureError("Invalid runId", 400);
    }
    if (!artifactName || typeof artifactName !== "string") {
      return secureError("Invalid artifactName", 400);
    }
    if (!filePath || typeof filePath !== "string" || filePath.includes("..") || filePath.startsWith("/")) {
      return secureError("Invalid filePath", 400);
    }

    const artifactsUrl = `https://api.github.com/repos/${githubRepo}/actions/runs/${runId}/artifacts`;
    const artifactsResp = await githubFetchJson<{ artifacts: Artifact[] }>(artifactsUrl, token);
    const artifacts = artifactsResp?.artifacts ?? [];
    const artifact = artifacts.find((a) => a.name === artifactName);

    if (!artifact) {
      return secureError(`Artifact not found: ${artifactName}`, 404, { runId });
    }
    if (artifact.expired) {
      return secureError(`Artifact expired: ${artifactName}`, 410, { runId });
    }

    const zipRes = await githubFetchRaw(artifact.archive_download_url, token);
    if (!zipRes.ok) {
      return secureError(`Failed to download artifact zip (${zipRes.status})`, 502, { runId });
    }

    const contentLength = Number(zipRes.headers.get("content-length") ?? "");
    if (Number.isFinite(contentLength) && contentLength > MAX_ARTIFACT_ARCHIVE_BYTES) {
      return secureError("Artifact zip too large", 413, {
        runId,
        artifactId: artifact.id,
        maxBytes: MAX_ARTIFACT_ARCHIVE_BYTES,
      });
    }

    const zipBytes = new Uint8Array(await zipRes.arrayBuffer());
    if (zipBytes.byteLength > MAX_ARTIFACT_ARCHIVE_BYTES) {
      return secureError("Artifact zip too large", 413, {
        runId,
        artifactId: artifact.id,
        maxBytes: MAX_ARTIFACT_ARCHIVE_BYTES,
      });
    }

    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(zipBytes);
    } catch (e: unknown) {
      const safeDebugMessage = sanitizeErrorText(e instanceof Error ? e.message : String(e));
      console.error("github-run-artifact-json unzip failed", {
        runId,
        artifactId: artifact.id,
        message: safeDebugMessage,
      });
      return secureError("Failed to unzip artifact archive", 502, { runId });
    }

    const found = pickFileFromZip(files, filePath);
    if (!found) {
      return secureError(`File not found in artifact zip: ${filePath}`, 404, {
        runId,
        artifactId: artifact.id,
        artifactName: artifact.name,
        availableFiles: Object.keys(files).slice(0, 50),
      });
    }

    const text = strFromU8(found);
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_TEXT_BYTES) {
      return secureError("Artifact payload too large", 413, {
        runId,
        artifactId: artifact.id,
        maxBytes: MAX_RESPONSE_TEXT_BYTES,
      });
    }

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    return jsonResponse(
      {
        ok: true,
        runId,
        artifactId: artifact.id,
        artifactName: artifact.name,
        filePath,
        text,
        json: parsed,
      },
      req,
      200,
      { noStore: true },
    );
  } catch (e: unknown) {
    const safeDebugMessage = sanitizeErrorText(e instanceof Error ? e.message : String(e));
    console.error("github-run-artifact-json unhandled error", { message: safeDebugMessage });
    return errorResponse("Unhandled error", req, 500, { code: "internal_error" }, {
      noStore: true,
    });
  }
});
