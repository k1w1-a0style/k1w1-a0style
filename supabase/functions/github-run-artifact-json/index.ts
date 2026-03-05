import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { requireAdminAuth } from "../_shared/auth.ts";
import { withErrorSanitization } from "../_shared/errorSanitization.ts";
import { githubFetchJson, githubFetchRaw } from "../_shared/github.ts";
import { isSafeGitHubRepo, isSafeRef } from "../_shared/security.ts";

// Deno std zip helper (extract to temp dir)
// NOTE: Use a fully qualified URL import to avoid relying on per-function import maps.
// Supabase Edge bundler requires bare specifiers to be resolved explicitly.
import { unzip } from "https://deno.land/std@0.203.0/archive/zip.ts";

type ReqBody = {
  githubRepo: string; // "owner/repo"
  runId: number;
  artifactName: string; // e.g. "ci-lite-logs"
  filePath: string; // e.g. "ci-logs/ci-lite-result.json"
  // Optional: allow passing workflow for extra validation/logging
  workflow?: string;
};

type Artifact = {
  id: number;
  name: string;
  archive_download_url: string;
  expired: boolean;
};

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

    // Download ZIP
    const zipRes = await githubFetchRaw(artifact.archive_download_url);
    if (!zipRes.ok) {
      return new Response(JSON.stringify({ error: `Failed to download artifact zip (${zipRes.status})`, runId }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tmpDir = await Deno.makeTempDir({ prefix: "ci-lite-artifact-" });
    try {
      const zipPath = `${tmpDir}/artifact.zip`;
      const bytes = new Uint8Array(await zipRes.arrayBuffer());
      await Deno.writeFile(zipPath, bytes);

      await unzip(zipPath, tmpDir);

      const targetPath = `${tmpDir}/${filePath}`;
      const text = await Deno.readTextFile(targetPath);

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
    } finally {
      try {
        await Deno.remove(tmpDir, { recursive: true });
      } catch {
        // ignore cleanup failures
      }
    }
  })
);
