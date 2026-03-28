// lib/diagnostics/diagnosticTypes.ts
// Extracted from buildPipelineDiagnostics.ts: types and helpers.

import {
  getLegacyEdgeAdminKey,
  getExpoToken,
  getGitHubToken,
  getRepoFileText,
  listRepoSecretNames,
  triggerWorkflow,
} from "../../infra/github/githubService";
import { ensureSupabaseClient } from "../supabase";
import type { PreflightPatch } from "./preflightTypes";


export type DiagnosticStatus = "pass" | "warn" | "fail" | "info";

export type DiagnosticFix = {
  label?: string;
  patch?: PreflightPatch;
  workflowDispatch?: {
    workflowFileName: string;
    ref?: string;
    inputs?: Record<string, string>;
    fallbackPatch?: PreflightPatch;
  };
};

export type DiagnosticCheck = {
  id: string;
  title: string;
  status: DiagnosticStatus;
  details?: string;
  fixHint?: string;
  fix?: DiagnosticFix;
};

export const safeTrim = (v: string | null | undefined) => (v ?? "").trim();

export const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    safeTrim(value),
  );

export const fileExists = async (
  owner: string,
  repo: string,
  path: string,
  ref: string,
) => {
  try {
    await getRepoFileText({ owner, repo, path, ref });
    return true;
  } catch {
    return false;
  }
};

export const readJsonFile = async <T>(
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<T | null> => {
  try {
    const text = await getRepoFileText({ owner, repo, path, ref });
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};
