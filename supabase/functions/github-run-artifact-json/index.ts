import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { requireAdminAuth } from "../_shared/auth.ts";
import { withErrorSanitization } from "../_shared/errorSanitization.ts";
import { githubFetchJson, githubFetchRaw } from "../_shared/github.ts";
import { isSafeGitHubRepo } from "../_shared/security.ts";

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
  // GitHub zips usually store forward slashes. Normalize common variants.
  return p.replace(/^\.\//, "").replace(/\\/g, "/");
}

function pickFileFromZip(files: Record<string, Uint8Array>, wanted: string): Uint8Array | null {
  const target = normalizeZipPath(wanted);

  // 1) Exact match
  if (files[target]) return files[target];

  // 2) Sometimes entries contain a leading folder (rare with GH artifacts, but safe)
  const keys = Object.keys(files);
  const suffixMatch = keys.find((k) => normalizeZipPath(k).endsWith("/" + target) || normalizeZipPath(k) === target);
  if (suffixMatch) return files[suffixMatch];

  return null;
}

Deno.serve(
  withErrorSanitization(async (req: Request) => {
    const opt = handleOptions(req);
    if (opt) return opt;

    // Auth (admin-only)
    await requireAdminAuth(req);

    const body = (await req.json().catch(() => null)) as ReqBody | null;
    if (!body) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { githubRepo, runId, artifactName, filePath } = body;

    if (!githubRepo || !isSafeGitHubRepo(githubRepo)) {
      return new Response(JSON.stringify({ error: "Invalid githubRepo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Number.isFinite(runId) || runId <= 0) {
      return new Response(JSON.stringify({ error: "Invalid runId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!artifactName || typeof artifactName !== "string") {
      return new Response(JSON.stringify({ error: "Invalid artifactName" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!filePath || typeof filePath !== "string" || filePath.includes("..") || filePath.startsWith("/")) {
      return new Response(JSON.stringify({ error: "Invalid filePath" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch artifacts for run
    const artifactsUrl = `https://api.github.com/repos/${githubRepo}/actions/runs/${runId}/artifacts`;
    const artifactsResp = await githubFetchJson<{ artifacts: Artifact[] }>(artifactsUrl);
    const artifacts = artifactsResp?.artifacts ?? [];
    const artifact = artifacts.find((a) => a.name === artifactName);

    if (!artifact) {
      return new Response(JSON.stringify({ error: `Artifact not found: ${artifactName}`, runId }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (artifact.expired) {
      return new Response(JSON.stringify({ error: `Artifact expired: ${artifactName}`, runId }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download ZIP (GitHub requires auth header; githubFetchRaw already handles it)
    const zipRes = await githubFetchRaw(artifact.archive_download_url);
    if (!zipRes.ok) {
      return new Response(JSON.stringify({ error: `Failed to download artifact zip (${zipRes.status})`, runId }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const zipBytes = new Uint8Array(await zipRes.arrayBuffer());

    // Unzip in-memory
    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(zipBytes);
    } catch (e) {
      return new Response(JSON.stringify({ error: `Failed to unzip artifact: ${String(e)}`, runId }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const found = pickFileFromZip(files, filePath);
    if (!found) {
      return new Response(
        JSON.stringify({
          error: `File not found in artifact zip: ${filePath}`,
          runId,
          artifactId: artifact.id,
          artifactName: artifact.name,
          availableFiles: Object.keys(files).slice(0, 50),
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const text = strFromU8(found);

    // If it's JSON, parse and return object too
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        runId,
        artifactId: artifact.id,
        artifactName: artifact.name,
        filePath,
        text,
        json: parsed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  })
);
