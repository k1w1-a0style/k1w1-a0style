import type { MutableRefObject } from "react";

import type { ProjectData } from "../../../shared/types/project";
import type { PreflightPatch } from "../../../lib/diagnostics/preflightTypes";
import { markRepoSyncSignature } from "../../../lib/repoSyncOrchestration";
import { applyRepoFilePatchAtomic, triggerWorkflow } from "../../../infra/github/githubService";
import { parseOwnerRepo } from "../../../lib/diagnostics/ciAutoFix";
import { getErrorMessage } from "./fixRunnerResultHelpers";
import { collectDeletedPatchPaths, collectPatchTouchedPaths, sameProjectFiles } from "./useDiagnosticFixRunnerHelpers";

export async function syncPatchToGitHub(params: {
  label: string;
  patch: PreflightPatch;
  linkedRepo: string;
  linkedBranch?: string;
  projectRef: MutableRefObject<ProjectData | null>;
}) {
  const parsed = parseOwnerRepo(params.linkedRepo);
  if (!parsed) throw new Error("Kein verknüpftes Repo gefunden (owner/repo).");

  const branch = (params.linkedBranch || "").trim();
  if (!branch) {
    throw new Error("Kein Branch verknüpft.");
  }

  const touched = collectPatchTouchedPaths(params.patch);
  const deletedSet = new Set(collectDeletedPatchPaths(params.patch));

  const filesNow = [...(params.projectRef.current?.files ?? [])];
  const nowMap = new Map(filesNow.map((f) => [f.path, f.content] as const));
  const upserts: Array<{ path: string; content: string }> = [];

  for (const p of touched) {
    if (deletedSet.has(p)) continue;
    const content = nowMap.get(p);
    if (typeof content !== "string") continue;
    upserts.push({ path: p, content });
  }

  await applyRepoFilePatchAtomic(
    parsed.owner,
    parsed.repo,
    { upsert: upserts, delete: Array.from(deletedSet) },
    { branch, message: `Diagnostics: ${params.label}` },
  );

  const filesAfter = params.projectRef.current?.files ?? [];
  if (!sameProjectFiles(filesNow, filesAfter)) {
    throw new Error(
      "Lokaler Projektstand hat sich während GitHub-Sync geändert. Snapshot wurde gepusht, lokaler Stand ist inzwischen abgewichen.",
    );
  }

  await markRepoSyncSignature({
    linkedRepo: params.linkedRepo,
    linkedBranch: branch,
    files: filesNow,
  });
}

export async function dispatchWorkflowFix(params: {
  owner: string;
  repo: string;
  workflowFileName: string;
  workflowRef: string;
  inputs: Record<string, string>;
  fallbackPatch?: PreflightPatch;
  applyPatch: (label: string, patch: PreflightPatch) => Promise<unknown>;
}) {
  void params.applyPatch;
  try {
    await triggerWorkflow(
      params.owner,
      params.repo,
      params.workflowFileName,
      params.workflowRef,
      params.inputs,
    );
  } catch (error: unknown) {
    const msg = getErrorMessage(error, "");
    if (/404|not found/i.test(msg) && params.fallbackPatch) {
      throw new Error(
        `missing_workflow: '${params.workflowFileName}' nicht gefunden. Bootstrap-Patch wurde lokal NICHT automatisch angewendet, da ohne direkten GitHub-Sync kein ehrlicher Retry möglich ist.`,
      );
    }
    throw error;
  }
}
