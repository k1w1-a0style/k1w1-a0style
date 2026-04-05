import type { MutableRefObject } from "react";

import type { ProjectData } from "../../../shared/types/project";
import type { PreflightPatch } from "../../../lib/diagnostics/preflightTypes";
import { markRepoSyncSignature } from "../../../lib/repoSyncOrchestration";
import { createOrUpdateFile, deleteRepoFile, triggerWorkflow } from "../../../infra/github/githubService";
import { parseOwnerRepo } from "../../../lib/diagnostics/ciAutoFix";
import { getErrorMessage } from "./fixRunnerResultHelpers";
import { collectDeletedPatchPaths, collectPatchTouchedPaths } from "./useDiagnosticFixRunnerHelpers";

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

  const filesNow = params.projectRef.current?.files ?? [];
  const nowMap = new Map(filesNow.map((f) => [f.path, f.content] as const));

  for (const p of touched) {
    if (deletedSet.has(p)) continue;
    const content = nowMap.get(p);
    if (typeof content !== "string") continue;
    await createOrUpdateFile(
      parsed.owner,
      parsed.repo,
      p,
      content,
      `Diagnostics: ${params.label}`,
      branch,
    );
  }

  for (const p of Array.from(deletedSet)) {
    await deleteRepoFile(parsed.owner, parsed.repo, p, `Diagnostics: ${params.label}`, branch);
  }

  await markRepoSyncSignature({
    linkedRepo: params.linkedRepo,
    linkedBranch: branch,
    files: params.projectRef.current?.files ?? [],
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
      await params.applyPatch(`Bootstrap ${params.workflowFileName}`, params.fallbackPatch);
      await triggerWorkflow(
        params.owner,
        params.repo,
        params.workflowFileName,
        params.workflowRef,
        params.inputs,
      );
      return;
    }
    throw error;
  }
}
