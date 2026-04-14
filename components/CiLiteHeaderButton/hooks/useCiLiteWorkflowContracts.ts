import { buildOperatorPrecheckMessage } from "../../../lib/auth/operatorContract";

export const splitRepoFullName = (
  repoFullName: string,
): { owner: string; repo: string } | null => {
  const [owner, repo] = String(repoFullName || "").trim().split("/");
  if (!owner || !repo) return null;
  return { owner, repo };
};

export type CiLiteDispatchSelectionResult =
  | {
      ok: true;
      selection: {
        owner: string;
        repo: string;
        branch: string;
      };
    }
  | {
      ok: false;
      message: string;
    };

export const resolveCiLiteDispatchSelection = (params: {
  githubRepo: string;
  branch: string;
}): CiLiteDispatchSelectionResult => {
  const repoParts = splitRepoFullName(params.githubRepo);
  if (!repoParts) {
    return {
      ok: false,
      message: "Kein gültiges Repo (owner/repo) ausgewählt.",
    };
  }

  const targetBranch = params.branch.trim();
  if (!targetBranch) {
    return {
      ok: false,
      message: "CI Lite blockiert: Kein Branch verknüpft. Bitte im Repo-Screen einen Branch auswählen.",
    };
  }

  return {
    ok: true,
    selection: {
      owner: repoParts.owner,
      repo: repoParts.repo,
      branch: targetBranch,
    },
  };
};

export const resolveCiLiteSyncStateError = (
  syncState: "in_sync" | "out_of_sync" | "unknown",
): string | null => {
  if (syncState === "in_sync") return null;
  if (syncState === "out_of_sync") {
    return "CI Lite blockiert: Lokale Änderungen sind noch nicht im gewählten Repo/Branch. Bitte zuerst pushen.";
  }
  return "CI Lite blockiert: Sync-Status lokal↔Repo ist unklar. Bitte zuerst explizit pushen.";
};

export const resolveCiLiteMissingJwtMessage = (
  context: "artifact" | "lookup" | "dispatch",
): string => {
  if (context === "artifact") {
    return buildOperatorPrecheckMessage({
      action: "CI-Lite-Artefakt",
      reason: "missing_jwt",
    });
  }
  if (context === "lookup") {
    return buildOperatorPrecheckMessage({
      action: "Workflow-Run-Lookup",
      reason: "missing_jwt",
    });
  }
  return buildOperatorPrecheckMessage({
    action: "Workflow-Dispatch",
    reason: "missing_jwt",
  });
};

export type CiLiteLookupCandidate = {
  id?: unknown;
  html_url?: unknown;
} | null | undefined;

export const resolveCiLiteMatchedRun = (
  candidate: CiLiteLookupCandidate,
): { runId: number; runUrl: string | null } | null => {
  if (!candidate?.id) return null;
  const parsedRunId = Number(candidate.id);
  if (!Number.isFinite(parsedRunId) || parsedRunId <= 0 || !Number.isInteger(parsedRunId)) return null;
  const runUrl = typeof candidate.html_url === "string" ? candidate.html_url.trim() : "";
  return {
    runId: parsedRunId,
    runUrl: runUrl || null,
  };
};
