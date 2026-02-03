// lib/diagnostics/diagnosticUploader.ts
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import type { ProjectFile } from "../../contexts/types";
import { ensureSupabaseClient } from "../supabase";
import type { PreflightCheckResult, PreflightTarget } from "./preflightTypes";
import { safeTruncate, sanitizeJsonString, sanitizeText } from "./sanitize";

const SNAPSHOT_PATHS = [
  "package.json",
  "app.json",
  "app.config.js",
  "tsconfig.json",
  "eas.json",
  "index.js",
  "App.tsx",
];

function pickFile(files: ProjectFile[], path: string): ProjectFile | undefined {
  return files.find((f) => f.path === path);
}

function buildSnapshots(files: ProjectFile[]) {
  const out: Array<{ path: string; content: string; truncated?: boolean }> = [];

  for (const p of SNAPSHOT_PATHS) {
    const f = pickFile(files, p);
    if (!f) continue;

    let content = f.content;
    if (p.endsWith(".json")) content = sanitizeJsonString(content);
    else content = sanitizeText(content);

    const max = 20000;
    const { text, truncated } = safeTruncate(content, max);
    out.push({
      path: p,
      content: text,
      truncated: truncated ? true : undefined,
    });
  }

  return out;
}

export type DiagnosticUploadInput = {
  deviceId: string;
  appVersion?: string;
  projectName?: string;
  target: PreflightTarget;
  checks: PreflightCheckResult[];
  projectFiles: ProjectFile[];
  notes?: string;

  // optional: wenn du von außen idempotent sein willst
  clientRequestId?: string;
};

/**
 * Upload via RPC:
 * - returns REAL db id
 * - anon SELECT bleibt aus (RLS)
 * - server-side rate limit + hardening kann in SQL passieren
 */
export async function uploadDiagnosticReport(
  input: DiagnosticUploadInput,
): Promise<{ id: number } | null> {
  let supabase;
  try {
    supabase = await ensureSupabaseClient();
  } catch (e) {
    console.warn("[diagnostics] supabase init failed", e);
    return null;
  }

  const summary = {
    counts: input.checks.reduce(
      (acc, c) => {
        acc[c.status] += 1;
        return acc;
      },
      { pass: 0, warn: 0, fail: 0 } as Record<"pass" | "warn" | "fail", number>,
    ),
    platform: "android",
  };

  const snapshots = buildSnapshots(input.projectFiles);

  // stabile id pro upload (idempotent)
  const clientRequestId =
    input.clientRequestId && input.clientRequestId.trim()
      ? input.clientRequestId.trim()
      : uuidv4();

  const payload = {
    device_id: input.deviceId,
    client_request_id: clientRequestId,
    app_version: input.appVersion ?? null,
    project_name: input.projectName ?? null,
    target:
      input.target.mode === "expoGo"
        ? "expoGo"
        : input.target.profile === "all"
          ? "eas:all"
          : `eas:${input.target.profile}`,
    summary,
    snapshots,
    notes: input.notes
      ? sanitizeText(safeTruncate(input.notes, 2000).text)
      : null,
  };

  const { data, error } = await supabase.rpc("insert_diagnostic_upload", {
    payload,
  });

  if (error) {
    console.warn("[diagnostics] upload failed", error);
    return null;
  }

  // RPC returns bigint -> JS number (ok für kleine ids)
  const idNum = typeof data === "number" ? data : Number(data);
  if (!Number.isFinite(idNum)) return null;

  return { id: idNum };
}

// ---------------------------------------------------------------------------
// Backwards-compatible API expected by DiagnosticScreen.tsx
// ---------------------------------------------------------------------------

export function formatDiagnosticUpload(args: {
  deviceId: string;
  clientRequestId?: string;
  projectName?: string;
  target: PreflightTarget;
  results: PreflightCheckResult[];
  files: ProjectFile[];
  appVersion?: string;
  notes?: string;
}): DiagnosticUploadInput {
  return {
    deviceId: args.deviceId,
    clientRequestId: args.clientRequestId,
    appVersion: args.appVersion,
    projectName: args.projectName,
    target: args.target,
    checks: args.results,
    projectFiles: args.files,
    notes: args.notes,
  };
}

export async function uploadDiagnosticToSupabase(
  payload: DiagnosticUploadInput,
): Promise<{ id: number } | null> {
  return uploadDiagnosticReport(payload);
}
