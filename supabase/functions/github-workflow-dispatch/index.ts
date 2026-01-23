import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAdminKey, rateLimit } from "../_shared/auth.ts";
import { validateGitHubRepo, sanitizeString } from "../_shared/validation.ts";
import { githubHeaders } from "../_shared/github.ts";

type JsonObj = Record<string, unknown>;

async function readJsonObject(
  req: Request,
  maxBytes: number,
): Promise<JsonObj | null> {
  const raw = await req.text();
  if (raw.length > maxBytes) return null;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as JsonObj;
  } catch {
    return null;
  }
}

function pickString(obj: JsonObj, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

function pickGitHubRepo(obj: JsonObj): string | undefined {
  const direct = pickString(obj, "githubRepo", "github_repo", "repoFullName");
  if (direct) return direct;
  const owner = pickString(obj, "owner", "githubOwner");
  const repo = pickString(obj, "repo", "githubRepoName");
  if (owner && repo) return `${owner}/${repo}`;
  return undefined;
}

/**
 * Triggers a GitHub Actions workflow via workflow_dispatch.
 * Used by the app to trigger workflows without manual UI interaction.
 *
 * Security:
 * - Admin key gate (if configured)
 * - Rate limit
 * - Strict input validation and size limits
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const auth = requireAdminKey(req);
  if (auth) return auth;

  const rl = rateLimit(req, "github-workflow-dispatch");
  if (rl) return rl;

  try {
    const obj = await readJsonObject(req, 64 * 1024);
    if (!obj) {
      return errorResponse("Invalid JSON body", req, 400, {
        error: "Body must be a JSON object (<= 64 KiB)",
      });
    }

    const githubRepo = pickGitHubRepo(obj) ?? (obj as any).githubRepo;
    const repoV = validateGitHubRepo(githubRepo);
    if (!repoV.valid) {
      return errorResponse("Validation failed", req, 400, {
        error: repoV.error,
        receivedType: typeof (obj as any).githubRepo,
        keys: Object.keys(obj).slice(0, 25),
      });
    }

    const workflowV = sanitizeString(obj.workflowFile, 200);
    if (!workflowV.valid) {
      return errorResponse("Validation failed", req, 400, {
        error: workflowV.error,
      });
    }

    // Allow explicit ref (branch/tag/SHA). Optional.
    const refRaw = pickString(obj, "ref", "branch", "gitRef");
    const refV = sanitizeString(refRaw, 200);
    const ref = refV.valid ? refV.value || undefined : undefined;

    // Optional inputs map (string->string). Limit size & keys to avoid abuse.
    let inputs: Record<string, string> | undefined;
    if (obj.inputs !== undefined && obj.inputs !== null) {
      if (typeof obj.inputs !== "object" || Array.isArray(obj.inputs)) {
        return errorResponse("Validation failed", req, 400, {
          error: "inputs must be an object",
        });
      }
      const inObj = obj.inputs as Record<string, unknown>;
      const keys = Object.keys(inObj);
      if (keys.length > 50) {
        return errorResponse("Validation failed", req, 400, {
          error: "inputs too large (max 50 keys)",
        });
      }
      inputs = {};
      for (const k of keys) {
        const kV = sanitizeString(k, 64);
        if (!kV.valid || !kV.value) {
          return errorResponse("Validation failed", req, 400, {
            error: "invalid input key",
          });
        }
        const vV = sanitizeString(inObj[k], 400);
        if (!vV.valid) {
          return errorResponse("Validation failed", req, 400, {
            error: `invalid input value for ${k}`,
          });
        }
        inputs[kV.value] = vV.value || "";
      }
    }

    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
    if (!GITHUB_TOKEN) {
      return errorResponse("Missing required environment variables", req, 500, {
        missing: { GITHUB_TOKEN: false },
      });
    }

    const dispatchUrl = `https://api.github.com/repos/${repoV.value}/actions/workflows/${workflowV.value}/dispatches`;
    const payload: Record<string, unknown> = {};
    if (ref) payload.ref = ref;
    if (inputs) payload.inputs = inputs;

    const res = await fetch(dispatchUrl, {
      method: "POST",
      headers: githubHeaders(GITHUB_TOKEN),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      return errorResponse("GitHub workflow dispatch failed", req, res.status, {
        status: res.status,
        body: errorText,
      });
    }

    return jsonResponse(
      {
        ok: true,
        githubRepo: repoV.value,
        workflowFile: workflowV.value,
        ref: ref ?? null,
      },
      req,
      200,
    );
  } catch (err: any) {
    console.error(
      "❌ github-workflow-dispatch error",
      err?.message ?? err,
      err?.stack,
    );
    return errorResponse(
      "Unhandled exception in github-workflow-dispatch",
      req,
      500,
      {
        message: err?.message || "Unknown error",
      },
    );
  }
});
