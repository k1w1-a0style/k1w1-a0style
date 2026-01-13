// lib/diagnostics/diagnosticUploader.ts
import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
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

// UUIDv4 without Node crypto (Expo-safe)
async function uuidv4(): Promise<string> {
  try {
    const b = await Crypto.getRandomBytesAsync(16);
    // RFC 4122 version/variant bits
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;

    const hex = Array.from(b).map((x) => x.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
      .slice(6, 8)
      .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  } catch {
    // last-resort fallback (still unique-ish, but less ideal)
    const r = () =>
      Math.floor(Math.random() * 0xffffffff)
        .toString(16)
        .padStart(8, "0");
    return `${r()}-${r().slice(0, 4)}-4${r().slice(0, 3)}-8${r().slice(0, 3)}-${r()}${r().slice(0, 4)}`;
  }
}

export type DiagnosticUploadInput = {
  deviceId: string;
  appVersion?: string;
  projectName?: string;
  target: PreflightTarget;
  checks: PreflightCheckResult[];
  projectFiles: ProjectFile[];
  notes?: string;
};

/**
 * Upload that returns REAL DB id via RPC (no anon SELECT needed).
 * DB should have:
 * - table public.diagnostic_uploads (RLS on)
 * - anon INSERT policy (already)
 * - RPC function public.insert_diagnostic_upload(...) SECURITY DEFINER that returns bigint id
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
    platform: Platform.OS,
  };

  const snapshots = buildSnapshots(input.projectFiles);

  const payload = {
    device_id: input.deviceId,
    app_version: input.appVersion ?? null,
    project_name: input.projectName ?? null,
    target:
      input.target.mode === "expoGo" ? "expoGo" : `eas:${input.target.profile}`,
    summary,
    snapshots,
    notes: input.notes
      ? sanitizeText(safeTruncate(input.notes, 2000).text)
      : null,
  };

  const clientRequestId = await uuidv4();

  // 1) Prefer RPC to get real DB id without opening SELECT for anon
  try {
    const { data, error } = await supabase.rpc("insert_diagnostic_upload", {
      p_device_id: payload.device_id,
      p_app_version: payload.app_version,
      p_project_name: payload.project_name,
      p_target: payload.target,
      p_summary: payload.summary,
      p_snapshots: payload.snapshots,
      p_notes: payload.notes,
      p_client_request_id: clientRequestId,
    });

    if (error) {
      console.warn("[diagnostics] upload rpc failed", error);
      return null;
    }

    const idNum = typeof data === "number" ? data : Number(data);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      console.warn("[diagnostics] upload rpc returned invalid id", data);
      return null;
    }

    return { id: idNum };
  } catch (e) {
    console.warn("[diagnostics] upload rpc threw", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Backwards-compatible API expected by DiagnosticScreen.tsx
// ---------------------------------------------------------------------------

export function formatDiagnosticUpload(args: {
  deviceId: string;
  projectName?: string;
  target: PreflightTarget;
  results: PreflightCheckResult[];
  files: ProjectFile[];
  appVersion?: string;
  notes?: string;
}): DiagnosticUploadInput {
  return {
    deviceId: args.deviceId,
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
