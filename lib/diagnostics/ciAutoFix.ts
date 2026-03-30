/* Auto-fix CI/Workflows for generated repos.
 * - Pushes canonical workflows into linked GitHub repo/branch
 * - Verifies required secrets exist
 *
 * NOTE: This runs entirely "in-app" via GitHub Contents API (createOrUpdateFile).
 */
import {
  createOrUpdateFile,
  getRepoFileText,
  listRepoSecretNames,
} from "../../infra/github/githubService";
import {
  classifyManagedWorkflowState,
  getAutoFixManagedWorkflowDefinitions,
  type ManagedWorkflowDetectedState,
} from "./managedWorkflowRegistry";

export type ManagedWorkflowApplyState = "unchanged" | "updated" | "update_failed";

export type CiFixChange = {
  path: string;
  changed: boolean;
  message: string;
  detectedState: ManagedWorkflowDetectedState;
  applyState: ManagedWorkflowApplyState;
  error?: string;
};

export type SecretsCheck = {
  required: string[];
  present: string[];
  missing: string[];
};

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
};

const buildWorkflowMessage = (params: {
  detectedState: ManagedWorkflowDetectedState;
  applyState: ManagedWorkflowApplyState;
}): string => {
  const { detectedState, applyState } = params;

  if (applyState === "unchanged") {
    return detectedState === "current"
      ? "Current managed workflow"
      : "No update applied";
  }

  if (applyState === "updated") {
    return detectedState === "missing"
      ? "Update pushed (managed workflow was missing)"
      : "Update pushed (managed workflow drift repaired)";
  }

  return detectedState === "missing"
    ? "Update failed (managed workflow was missing)"
    : "Update failed (managed workflow drift detected)";
};

export function parseOwnerRepo(
  input: string,
): { owner: string; repo: string } | null {
  const raw = (input || "").trim().replace(/^https?:\/\/github\.com\//i, "");
  const m = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?\/?$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

export const REQUIRED_SECRETS = ["EXPO_TOKEN"];

// Optional (used only for in-app status updates if you pass a job_id)
// NOTE: Do NOT require these; service-role keys should not be distributed broadly.

export async function checkRepoSecrets(
  owner: string,
  repo: string,
): Promise<SecretsCheck> {
  const present = await listRepoSecretNames(owner, repo);
  const missing = REQUIRED_SECRETS.filter((s) => !present.includes(s));
  return {
    required: [...REQUIRED_SECRETS],
    present,
    missing,
  };
}

export async function autoFixCIWorkflows(params: {
  owner: string;
  repo: string;
  branch: string;
}): Promise<CiFixChange[]> {
  const { owner, repo, branch } = params;

  const results: CiFixChange[] = [];
  const entries = getAutoFixManagedWorkflowDefinitions();

  for (const entry of entries) {
    let current = "";
    try {
      current = await getRepoFileText({
        owner,
        repo,
        path: entry.path,
        ref: branch,
      });
    } catch {
      current = "";
    }

    const detectedState = classifyManagedWorkflowState({
      currentContent: current,
      desiredContent: entry.content,
    });

    if (detectedState === "current") {
      results.push({
        path: entry.path,
        changed: false,
        detectedState,
        applyState: "unchanged",
        message: buildWorkflowMessage({
          detectedState,
          applyState: "unchanged",
        }),
      });
      continue;
    }

    try {
      await createOrUpdateFile(
        owner,
        repo,
        entry.path,
        entry.content.replace(/\r\n/g, "\n"),
        `fix(ci): update ${entry.fileName}`,
        branch,
      );

      results.push({
        path: entry.path,
        changed: true,
        detectedState,
        applyState: "updated",
        message: buildWorkflowMessage({
          detectedState,
          applyState: "updated",
        }),
      });
    } catch (error: unknown) {
      results.push({
        path: entry.path,
        changed: false,
        detectedState,
        applyState: "update_failed",
        message: buildWorkflowMessage({
          detectedState,
          applyState: "update_failed",
        }),
        error: toErrorMessage(error, "Unknown workflow update failure"),
      });
    }
  }

  // Ensure repo ignores patch ZIPs produced by this builder (avoid accidentally committing patch bundles)
  // We keep this narrow (k1w1-* + *_patch*) and do NOT ignore all *.zip to avoid breaking repos that legitimately version zip assets.
  const giPath = ".gitignore";
  const giMarker = "# --- k1w1 apk-builder: ignore patch zips ---";
  const giBlock =
    giMarker +
    "\n" +
    [
      "k1w1-*.zip",
      "*_patch*.zip",
      "project_src_*.zip",
      "project_dump_*.zip",
      "k1w1-*-patch.zip",
      "k1w1-*-hotfix*.zip",
    ].join("\n") +
    "\n";

  try {
    const existing = await getRepoFileText({
      owner,
      repo,
      path: giPath,
      ref: branch,
    });
    if (!existing.includes(giMarker)) {
      const next = (existing.trimEnd() + "\n\n" + giBlock).replace(
        /\r\n/g,
        "\n",
      );
      await createOrUpdateFile(
        owner,
        repo,
        giPath,
        next,
        "chore(ci): ignore patch zips",
        branch,
      );
      results.push({
        path: giPath,
        changed: true,
        detectedState: existing.trim() ? "drifted" : "missing",
        applyState: "updated",
        message: "Update pushed (.gitignore patch ZIP guard added)",
      });
    } else {
      results.push({
        path: giPath,
        changed: false,
        detectedState: "current",
        applyState: "unchanged",
        message: ".gitignore already ignores patch ZIPs",
      });
    }
  } catch (e: unknown) {
    const msg = toErrorMessage(e, "");
    const looksMissing =
      msg.includes("404") || msg.toLowerCase().includes("not found");
    if (!looksMissing) {
      results.push({
        path: giPath,
        changed: false,
        detectedState: "drifted",
        applyState: "update_failed",
        message: "Update failed (.gitignore could not be read)",
        error: msg.slice(0, 120),
      });
    } else {
      try {
        const next = (giBlock + "\n").replace(/\r\n/g, "\n");
        await createOrUpdateFile(
          owner,
          repo,
          giPath,
          next,
          "chore(ci): add .gitignore for patch zips",
          branch,
        );
        results.push({
          path: giPath,
          changed: true,
          detectedState: "missing",
          applyState: "updated",
          message: "Update pushed (.gitignore created for patch ZIP guard)",
        });
      } catch (error: unknown) {
        results.push({
          path: giPath,
          changed: false,
          detectedState: "missing",
          applyState: "update_failed",
          message: "Update failed (.gitignore was missing)",
          error: toErrorMessage(error, "Unknown .gitignore update failure"),
        });
      }
    }
  }

  return results;
}
