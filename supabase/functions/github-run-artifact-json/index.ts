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
    allowJwtAuthHeaderWithAdmin: true,
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
    const token = getGithubToken();
    if (!token) {
      return errorResponse("Missing GitHub token for artifact lookup", req, 500);
    }

    const parsedBody = await parseJsonBody(req, 20_000);
    if (isParsedJsonBodyError(parsedBody)) {
      const status = parsedBody.error.toLowerCase().includes("too large") ? 413 : 400;
      return errorResponse(status === 413 ? "Request too large" : "Invalid JSON body", req, status);
    }

    const body = parsedBody.body as ReqBody;
    const { githubRepo, runId, artifactName, filePath } = body;

    if (!isSafeGitHubRepoFullName(githubRepo)) {
      return errorResponse("Invalid githubRepo", req, 400);
    }
    if (!isAllowedGithubRepo(githubRepo)) {
      return errorResponse("githubRepo not allowed", req, 403, { githubRepo });
    }
    if (!Number.isFinite(runId) || runId <= 0) {
      return errorResponse("Invalid runId", req, 400);
    }
    if (!artifactName || typeof artifactName !== "string") {
      return errorResponse("Invalid artifactName", req, 400);
    }
    if (!filePath || typeof filePath !== "string" || filePath.includes("..") || filePath.startsWith("/")) {
      return errorResponse("Invalid filePath", req, 400);
    }

    const artifactsUrl = `https://api.github.com/repos/${githubRepo}/actions/runs/${runId}/artifacts`;
    const artifactsResp = await githubFetchJson<{ artifacts: Artifact[] }>(artifactsUrl, token);
    const artifacts = artifactsResp?.artifacts ?? [];
    const artifact = artifacts.find((a) => a.name === artifactName);

    if (!artifact) {
      return errorResponse(`Artifact not found: ${artifactName}`, req, 404, { runId });
    }
    if (artifact.expired) {
      return errorResponse(`Artifact expired: ${artifactName}`, req, 410, { runId });
    }

    const zipRes = await githubFetchRaw(artifact.archive_download_url, token);
    if (!zipRes.ok) {
      return errorResponse(`Failed to download artifact zip (${zipRes.status})`, req, 502, { runId });
    }

    const zipBytes = new Uint8Array(await zipRes.arrayBuffer());

    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(zipBytes);
    } catch (e) {
      return errorResponse(`Failed to unzip artifact: ${String(e)}`, req, 502, { runId });
    }

    const found = pickFileFromZip(files, filePath);
    if (!found) {
      return errorResponse(`File not found in artifact zip: ${filePath}`, req, 404, {
        runId,
        artifactId: artifact.id,
        artifactName: artifact.name,
        availableFiles: Object.keys(files).slice(0, 50),
      });
    }

    const text = strFromU8(found);

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
    );
  } catch (e) {
    return errorResponse(String(e instanceof Error ? e.message : e), req, 500);
  }
});
