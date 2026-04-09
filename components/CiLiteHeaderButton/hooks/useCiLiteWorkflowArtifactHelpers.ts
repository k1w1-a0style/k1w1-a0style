import { WORKFLOW_CI_LITE_AUTOFIX } from "../types";

export type ArtifactFetchContextInput = {
  githubRepo: string | null | undefined;
  workflowId: string | null | undefined;
  workflowRunId: number | null | undefined;
  workflowStatus: string | null | undefined;
};

export type CiLiteArtifactJson = {
  ok: boolean;
  eslint_exit?: number;
  tsc_exit?: number;
  source_commit_sha?: string;
  source_sha?: string;
  github_sha?: string;
};

export const resolveCiLiteArtifactRequest = (workflowId: string): {
  artifactName: "ci-lite-logs" | "ci-lite-autofix-logs";
  filePath: "ci-logs/ci-lite-result.json" | "ci-logs/ci-lite-autofix-result.json";
} => {
  if (workflowId === WORKFLOW_CI_LITE_AUTOFIX) {
    return {
      artifactName: "ci-lite-autofix-logs",
      filePath: "ci-logs/ci-lite-autofix-result.json",
    };
  }
  return {
    artifactName: "ci-lite-logs",
    filePath: "ci-logs/ci-lite-result.json",
  };
};

export const buildArtifactFetchContextKey = (input: ArtifactFetchContextInput): string | null => {
  const repo = String(input.githubRepo ?? "").trim();
  const workflowId = String(input.workflowId ?? "").trim();
  const status = String(input.workflowStatus ?? "").trim();

  if (!repo || !workflowId || !input.workflowRunId || status !== "completed") {
    return null;
  }

  return `${repo}::${workflowId}::${String(input.workflowRunId)}`;
};

export const parseCiLiteArtifactJson = (payload: unknown): CiLiteArtifactJson => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Artifact JSON missing or invalid");
  }

  const src = payload as Record<string, unknown>;
  const readNum = (k: "eslint_exit" | "tsc_exit"): number | undefined =>
    typeof src[k] === "number" ? src[k] : undefined;
  const readSha = (k: "source_commit_sha" | "source_sha" | "github_sha"): string | undefined =>
    typeof src[k] === "string" ? src[k].trim() || undefined : undefined;

  return {
    ok: typeof src.ok === "boolean" ? src.ok : Boolean(src.ok),
    eslint_exit: readNum("eslint_exit"),
    tsc_exit: readNum("tsc_exit"),
    source_commit_sha: readSha("source_commit_sha"),
    source_sha: readSha("source_sha"),
    github_sha: readSha("github_sha"),
  };
};

export const readCiLiteArtifactPayloadCandidate = (payload: unknown): unknown => {
  const parsed = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  if (!parsed) return null;
  const inlineJson = parsed.json;
  if (inlineJson && typeof inlineJson === "object") {
    return inlineJson;
  }
  if (typeof parsed.text === "string") {
    try {
      return JSON.parse(parsed.text);
    } catch {
      throw new Error("Artifact JSON missing or invalid");
    }
  }
  return null;
};
