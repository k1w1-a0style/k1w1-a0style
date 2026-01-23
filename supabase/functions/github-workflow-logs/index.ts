import {
  parseJsonBody,
  serve,
} from "https://deno.land/std@0.208.0/http/server.ts";
import { parseJsonBody, corsHeaders, handleCors } from "../_shared/cors.ts";
import { parseJsonBody, requireAdminKey, rateLimit } from "../_shared/auth.ts";
import { parseJsonBody, unzipSync, strFromU8 } from "npm:fflate@0.8.2";
import { parseJsonBody, githubHeaders } from "../_shared/github.ts";

const MAX_LOG_ZIP_BYTES = 15 * 1024 * 1024; // 15 MiB (compressed)
const MAX_LOG_UNZIPPED_BYTES = 50 * 1024 * 1024; // 50 MiB (uncompressed)
const MAX_LOG_FILES = 2000;

/**
 * Fetches GitHub Actions workflow logs
 * Returns parsed logs with timestamps and levels
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const auth = requireAdminKey(req);
  if (auth) return auth;

  const rl = rateLimit(req, "github-workflow-logs");
  if (rl) return rl;

  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.githubRepo || !body.runId) {
      return new Response(
        JSON.stringify({
          error: "Missing 'githubRepo' or 'runId' in request body",
        }),
        { headers: corsHeaders, status: 400 },
      );
    }

    const envToken = Deno.env.get("GITHUB_TOKEN");
    const { githubRepo, runId, githubToken, mode } = body;
    const GITHUB_TOKEN = githubToken || envToken;

    if (!GITHUB_TOKEN) {
      return new Response(JSON.stringify({ error: "Missing GitHub token" }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    // Get workflow run details
    const runUrl = `https://api.github.com/repos/${githubRepo}/actions/runs/${runId}`;
    const runResponse = await fetch(runUrl, {
      headers: githubHeaders(GITHUB_TOKEN),
    });

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      return new Response(
        JSON.stringify({
          error: "Failed to fetch workflow run",
          status: runResponse.status,
          details: errorText,
        }),
        { headers: corsHeaders, status: runResponse.status },
      );
    }

    const runData = await runResponse.json();

    // Get jobs for this run
    const jobsUrl = `https://api.github.com/repos/${githubRepo}/actions/runs/${runId}/jobs`;
    const jobsResponse = await fetch(jobsUrl, {
      headers: githubHeaders(GITHUB_TOKEN),
    });

    if (!jobsResponse.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch jobs" }), {
        headers: corsHeaders,
        status: jobsResponse.status,
      });
    }

    const jobsData = await jobsResponse.json();

    // If requested, fetch the real CLI log archive (zip) for this workflow run
    const wantRaw = (mode || "raw") === "raw";
    if (wantRaw) {
      const logsUrl = `https://api.github.com/repos/${githubRepo}/actions/runs/${runId}/logs`;
      const zipResp = await fetch(logsUrl, {
        headers: githubHeaders(GITHUB_TOKEN),
      });

      if (zipResp.ok) {
        const zipBuf = await zipResp.arrayBuffer();
        if (zipBuf.byteLength > MAX_LOG_ZIP_BYTES) {
          return new Response(
            JSON.stringify({
              error: `Logs zip too large (${zipBuf.byteLength} bytes)`,
            }),
            {
              status: 413,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        const buf = new Uint8Array(zipBuf);
        try {
          const files = unzipSync(buf);

          const names = Object.keys(files);
          if (names.length > MAX_LOG_FILES) {
            return new Response(
              JSON.stringify({
                error: `Too many files in logs zip (${names.length})`,
              }),
              {
                status: 413,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          let totalUnzipped = 0;
          for (const name of names) {
            totalUnzipped += files[name].length;
            if (totalUnzipped > MAX_LOG_UNZIPPED_BYTES) {
              return new Response(
                JSON.stringify({
                  error: `Logs too large after unzip (> ${MAX_LOG_UNZIPPED_BYTES} bytes)`,
                }),
                {
                  status: 413,
                  headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                  },
                },
              );
            }
          }

          const names = Object.keys(files)
            .filter((n) => n.toLowerCase().endsWith(".txt"))
            .sort((a, b) => a.localeCompare(b));

          // Concatenate all text files into a single raw log stream
          let combined = "";
          for (const name of names) {
            const text = strFromU8(files[name]);
            combined += `\n### ${name}\n` + text + "\n";
          }

          // Safety cap: keep only the last ~250k chars (mobile + edge limits)
          const MAX_CHARS = 250_000;
          if (combined.length > MAX_CHARS) {
            combined = combined.slice(combined.length - MAX_CHARS);
          }

          const lines = combined
            .split(/\r?\n/)
            .filter((l) => l.trim().length > 0);
          const logs = lines.map((line) => {
            const lower = line.toLowerCase();
            const level =
              lower.includes("##[error]") ||
              lower.includes("error") ||
              lower.includes("failed") ||
              lower.includes("exception")
                ? "error"
                : "raw";
            return {
              timestamp: "",
              message: line,
              level,
              step: undefined,
            };
          });

          return new Response(
            JSON.stringify({
              logs,
              workflowRun: runData,
              mode: "raw",
              jobs: jobsData.jobs || [],
            }),
            {
              headers: corsHeaders,
              status: 200,
            },
          );
        } catch (e) {
          // fall through to summary logs if unzip fails
          console.error("Failed to unzip GitHub logs:", e);
        }
      } else {
        const t = await zipResp.text().catch(() => "");
        console.error("GitHub logs zip fetch failed:", zipResp.status, t);
      }
    }

    // Parse logs from all jobs
    const logs: any[] = [];

    for (const job of jobsData.jobs || []) {
      // Add job start entry
      logs.push({
        timestamp: job.started_at || job.created_at,
        message: `▶️ Job started: ${job.name}`,
        level: "info",
        step: job.name,
      });

      // Add step entries
      for (const step of job.steps || []) {
        const level =
          step.conclusion === "failure"
            ? "error"
            : step.conclusion === "success"
              ? "info"
              : "info";

        const icon =
          step.conclusion === "failure"
            ? "❌"
            : step.conclusion === "success"
              ? "✅"
              : step.status === "in_progress"
                ? "⏳"
                : "⏸";

        logs.push({
          timestamp: step.started_at || new Date().toISOString(),
          message: `${icon} ${step.name}: ${step.conclusion || step.status}`,
          level,
          step: step.name,
        });
      }

      // Add job completion entry
      if (job.conclusion) {
        const icon = job.conclusion === "success" ? "✅" : "❌";
        logs.push({
          timestamp: job.completed_at || new Date().toISOString(),
          message: `${icon} Job ${job.conclusion}: ${job.name}`,
          level: job.conclusion === "failure" ? "error" : "info",
          step: job.name,
        });
      }
    }

    // Sort logs by timestamp
    logs.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    return new Response(
      JSON.stringify({
        ok: true,
        logs,
        workflowRun: {
          id: runData.id,
          status: runData.status,
          conclusion: runData.conclusion,
          html_url: runData.html_url,
          run_number: runData.run_number,
          created_at: runData.created_at,
          updated_at: runData.updated_at,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err: any) {
    console.error(
      "❌ github-workflow-logs error",
      err?.message ?? err,
      err?.stack,
    );

    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message || "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
