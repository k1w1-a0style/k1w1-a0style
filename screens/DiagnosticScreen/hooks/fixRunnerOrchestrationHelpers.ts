import type { PreflightCheckResult, PreflightPatch } from "../../../lib/diagnostics/preflightTypes";
import { parseOwnerRepo } from "../../../lib/diagnostics/ciAutoFix";
import { patchFingerprint } from "../../../lib/diagnostics/fixSafety";
import type { Status } from "../types";

export type PatchCandidate = {
  result: PreflightCheckResult;
  patch: PreflightPatch;
};

export const collectPatchCandidates = (items: PreflightCheckResult[]): PatchCandidate[] =>
  items
    .filter((item): item is PreflightCheckResult & { fix: { patch: PreflightPatch } } => !!item.fix?.patch)
    .map((item) => ({ result: item, patch: item.fix.patch }));

export const dedupePatchCandidates = (items: PatchCandidate[]): PatchCandidate[] => {
  const seen = new Set<string>();
  const out: PatchCandidate[] = [];
  for (const item of items) {
    const fingerprint = patchFingerprint(item.patch);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    out.push(item);
  }
  return out;
};

export const pickSmartFixCandidates = (items: PreflightCheckResult[]): PatchCandidate[] =>
  collectPatchCandidates(items).filter(
    ({ result }) => ((result.status ?? "pass") as Status) === "fail",
  );

export const pickAutoFixCandidates = (params: {
  autoFixScope: "visible" | "all";
  visibleResults: PreflightCheckResult[];
  fixableResults: PreflightCheckResult[];
  autoFixIncludeWarn: boolean;
}): PatchCandidate[] => {
  const source = params.autoFixScope === "visible" ? params.visibleResults : params.fixableResults;
  return collectPatchCandidates(source).filter(({ result }) => {
    const status = (result.status as Status) ?? "pass";
    if (status === "fail") return true;
    if (params.autoFixIncludeWarn && status === "warn") return true;
    return false;
  });
};

export const pickSelectedFixCandidates = (params: {
  sortedResults: PreflightCheckResult[];
  selected: Record<string, boolean>;
}): PatchCandidate[] =>
  collectPatchCandidates(params.sortedResults).filter(({ result }) => !!params.selected[result.id]);

export const resolveWorkflowDispatchTarget = (params: {
  linkedRepo: string;
  linkedBranch?: string;
  dispatchRef?: string;
}):
  | {
      ok: true;
      owner: string;
      repo: string;
      workflowRef: string;
    }
  | {
      ok: false;
      detail: string;
    } => {
  const parsed = parseOwnerRepo(params.linkedRepo);
  if (!parsed) {
    return {
      ok: false,
      detail: "Workflow-Fix ist ohne verknüpftes Repo nicht anwendbar.",
    };
  }
  const workflowRef = (params.dispatchRef || params.linkedBranch || "").trim();
  if (!workflowRef) {
    return {
      ok: false,
      detail: "Workflow-Fix ist ohne verknüpften Branch nicht anwendbar.",
    };
  }
  return {
    ok: true,
    owner: parsed.owner,
    repo: parsed.repo,
    workflowRef,
  };
};
