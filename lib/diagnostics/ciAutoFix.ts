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

export type CiFixChange = {
  path: string;
  changed: boolean;
  message: string;
};

export type SecretsCheck = {
  required: string[];
  present: string[];
  missing: string[];
};

export function parseOwnerRepo(
  input: string,
): { owner: string; repo: string } | null {
  const raw = (input || "").trim().replace(/^https?:\/\/github\.com\//i, "");
  const m = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?\/?$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

import {
  WORKFLOW_K1W1_TRIGGERED_BUILD,
  WORKFLOW_EAS_BUILD,
  WORKFLOW_RELEASE_BUILD,
  WORKFLOW_EAS_LINK,
} from "./workflowTemplates";

const WORKFLOWS: Record<string, string> = {
  "k1w1-triggered-build.yml": WORKFLOW_K1W1_TRIGGERED_BUILD,
  "eas-build.yml": WORKFLOW_EAS_BUILD,
  "release-build.yml": WORKFLOW_RELEASE_BUILD,
  "eas-link.yml": WORKFLOW_EAS_LINK,
};


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
  const entries = Object.entries(WORKFLOWS);

  for (const [fileName, desired] of entries) {
    const path = `.github/workflows/${fileName}`;

    let current = "";
    try {
      current = await getRepoFileText({ owner, repo, path, ref: branch });
    } catch {
      // file missing -> treat as empty
      current = "";
    }

    const normalizedCurrent = (current || "").replace(/\r\n/g, "\n");
    const normalizedDesired = (desired || "").replace(/\r\n/g, "\n");

    if (normalizedCurrent.trim() === normalizedDesired.trim()) {
      results.push({
        path,
        changed: false,
        message: "OK (already up to date)",
      });
      continue;
    }

    await createOrUpdateFile(
      owner,
      repo,
      path,
      normalizedDesired,
      `fix(ci): update ${fileName}`,
      branch,
    );

    results.push({
      path,
      changed: true,
      message: "Updated",
    });
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
        message: "Updated .gitignore to ignore patch ZIPs",
      });
    } else {
      results.push({
        path: giPath,
        changed: false,
        message: ".gitignore already ignores patch ZIPs",
      });
    }
  } catch (e) {
    const msg = String((e as any)?.message || e || "");
    const looksMissing =
      msg.includes("404") || msg.toLowerCase().includes("not found");
    if (!looksMissing) {
      results.push({
        path: giPath,
        changed: false,
        message: `Skipped .gitignore update (could not read existing file): ${msg.slice(0, 120)}`,
      });
    } else {
      // .gitignore missing -> create a minimal one with the ignore block
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
        message: "Created .gitignore to ignore patch ZIPs",
      });
    }
  }

  return results;
}
