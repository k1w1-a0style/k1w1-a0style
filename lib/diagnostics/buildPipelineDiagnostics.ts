import {
  getEdgeAdminKey,
  getExpoToken,
  getGitHubToken,
  getRepoFileText,
  listRepoSecretNames,
  triggerWorkflow,
} from "../../contexts/githubService";
import { ensureSupabaseClient } from "../supabase";

export type DiagnosticStatus = "pass" | "warn" | "fail" | "info";

export type DiagnosticCheck = {
  id: string;
  title: string;
  status: DiagnosticStatus;
  details?: string;
  fixHint?: string;
};

const safeTrim = (v: string | null | undefined) => (v ?? "").trim();

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    safeTrim(value),
  );

const fileExists = async (
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

const readJsonFile = async <T>(
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

export const runBuildPipelineDiagnostics = async (params: {
  owner: string;
  repo: string;
  branch?: string | null;
}) => {
  const ref = safeTrim(params.branch) || "main";

  const checks: DiagnosticCheck[] = [];

  // --- Local prerequisites ---
  const [ghToken, expoToken, adminKey] = await Promise.all([
    getGitHubToken(),
    getExpoToken(),
    getEdgeAdminKey(),
  ]);

  checks.push({
    id: "local.githubToken",
    title: "GitHub Token vorhanden",
    status: ghToken ? "pass" : "fail",
    fixHint: ghToken ? undefined : "In Connections GitHub Token setzen.",
  });

  checks.push({
    id: "local.expoToken",
    title: "Expo Token vorhanden",
    status: expoToken ? "pass" : "fail",
    fixHint: expoToken
      ? undefined
      : "Expo Token speichern (Connections / Settings).",
  });

  checks.push({
    id: "local.edgeAdminKey",
    title: "Edge Admin-Key vorhanden (x-k1w1-admin-key)",
    status: adminKey ? "pass" : "warn",
    fixHint: adminKey
      ? undefined
      : "Ohne Admin-Key sind manche Supabase-Checks nicht möglich (Edge Functions sind geschützt).",
  });

  // --- Repo files (branch-specific) ---
  const [
    hasAppConfigJs,
    hasAppConfigTs,
    hasAppJson,
    hasEasJson,
    hasEasProjectJson,
    hasLinkWorkflow,
    hasTriggeredBuildWorkflow,
  ] = await Promise.all([
    fileExists(params.owner, params.repo, "app.config.js", ref),
    fileExists(params.owner, params.repo, "app.config.ts", ref),
    fileExists(params.owner, params.repo, "app.json", ref),
    fileExists(params.owner, params.repo, "eas.json", ref),
    fileExists(params.owner, params.repo, "eas-project.json", ref),
    fileExists(
      params.owner,
      params.repo,
      ".github/workflows/eas-link.yml",
      ref,
    ),
    fileExists(
      params.owner,
      params.repo,
      ".github/workflows/k1w1-triggered-build.yml",
      ref,
    ),
  ]);

  const expoConfigOk = hasAppConfigJs || hasAppConfigTs || hasAppJson;
  checks.push({
    id: "repo.expoConfig",
    title: "Expo Config vorhanden (app.config.* / app.json)",
    status: expoConfigOk ? "pass" : "fail",
    details: `Branch: ${ref}`,
    fixHint: expoConfigOk
      ? undefined
      : "Im Repo muss app.config.js / app.config.ts oder app.json vorhanden sein.",
  });

  checks.push({
    id: "repo.easJson",
    title: "eas.json vorhanden",
    status: hasEasJson ? "pass" : "fail",
    fixHint: hasEasJson
      ? undefined
      : "eas.json fehlt → Template/Patch anwenden (sonst EAS Profiles fehlen).",
  });

  // --- EAS projectId persistent ---
  let projectId = "";
  let projectIdOk = false;

  if (hasEasProjectJson) {
    const data = await readJsonFile<{ projectId?: string }>(
      params.owner,
      params.repo,
      "eas-project.json",
      ref,
    );
    projectId = safeTrim(data?.projectId);
    projectIdOk = projectId ? isUuid(projectId) : false;
  }

  checks.push({
    id: "repo.easProjectId",
    title: "EAS projectId persistent (eas-project.json)",
    status: projectIdOk ? "pass" : "fail",
    details: projectId ? `projectId: ${projectId}` : undefined,
    fixHint: projectIdOk
      ? undefined
      : 'Button "EAS Projekt erstellen / verbinden" ausführen (committet projectId).',
  });

  // --- Workflows ---
  checks.push({
    id: "repo.workflow.easLink",
    title: "Workflow vorhanden: eas-link.yml",
    status: hasLinkWorkflow ? "pass" : "fail",
    fixHint: hasLinkWorkflow
      ? undefined
      : "Workflow fehlt → Template/Patch anwenden (für 1-Click EAS Linking).",
  });

  checks.push({
    id: "repo.workflow.triggeredBuild",
    title: "Workflow vorhanden: k1w1-triggered-build.yml",
    status: hasTriggeredBuildWorkflow ? "pass" : "fail",
    fixHint: hasTriggeredBuildWorkflow
      ? undefined
      : "Workflow fehlt → Template/Patch anwenden (für repository_dispatch Builds).",
  });

  // --- Secrets existence (names only) ---
  try {
    const names = await listRepoSecretNames(params.owner, params.repo);
    const hasExpoTokenSecret = names.includes("EXPO_TOKEN");
    const hasSupabaseUrlSecret = names.includes("SUPABASE_URL");
    const hasSupabaseServiceRoleSecret = names.includes(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

    checks.push({
      id: "repo.secret.expoToken",
      title: "Repo Secret vorhanden: EXPO_TOKEN",
      status: hasExpoTokenSecret ? "pass" : "fail",
      fixHint: hasExpoTokenSecret
        ? undefined
        : "Secretsync ausführen (EXPO_TOKEN fehlt).",
    });

    checks.push({
      id: "repo.secret.supabaseUrl",
      title: "Repo Secret vorhanden: SUPABASE_URL",
      status: hasSupabaseUrlSecret ? "pass" : "warn",
      fixHint: hasSupabaseUrlSecret
        ? undefined
        : "Für Remote-Reports sinnvoll: Secretsync SUPABASE_URL.",
    });

    checks.push({
      id: "repo.secret.supabaseServiceRole",
      title: "Repo Secret vorhanden: SUPABASE_SERVICE_ROLE_KEY",
      status: hasSupabaseServiceRoleSecret ? "pass" : "warn",
      fixHint: hasSupabaseServiceRoleSecret
        ? undefined
        : "Für Remote-Reports sinnvoll: Secretsync SUPABASE_SERVICE_ROLE_KEY.",
    });
  } catch (e: any) {
    checks.push({
      id: "repo.secret.list",
      title: "Repo Secrets abrufbar",
      status: "warn",
      details: e?.message || "Secrets konnten nicht gelesen werden.",
      fixHint:
        "GitHub Token braucht Zugriff auf Actions Secrets (Repo Admin oder entsprechende Permission).",
    });
  }

  // --- Optional: app.config.js should read eas-project.json ---
  if (hasAppConfigJs) {
    try {
      const appConfig = await getRepoFileText({
        owner: params.owner,
        repo: params.repo,
        path: "app.config.js",
        ref,
      });
      const usesEasProjectJson = appConfig.includes("eas-project.json");
      checks.push({
        id: "repo.appConfig.usesEasProjectJson",
        title: "app.config.js nutzt eas-project.json",
        status: usesEasProjectJson ? "pass" : "warn",
        fixHint: usesEasProjectJson
          ? undefined
          : "Empfehlung: app.config.js sollte projectId aus eas-project.json lesen (damit CI nicht auf ENV angewiesen ist).",
      });
    } catch {
      // ignore
    }
  }

  return { ref, checks };
};

export const triggerRemoteDiagnostics = async (params: {
  owner: string;
  repo: string;
  branch?: string | null;
}) => {
  const ref = safeTrim(params.branch) || "main";
  await triggerWorkflow(
    params.owner,
    params.repo,
    "k1w1-diagnostics.yml",
    ref,
    {
      branch: ref,
    },
  );
  return { ref };
};

export type RemoteDiagnosticsReport = {
  id: number;
  github_repo: string;
  branch: string | null;
  status: "pass" | "fail";
  project_id: string | null;
  workflow_run_id: string | null;
  commit_sha: string | null;
  errors: Array<{ code: string; message: string }>;
  created_at: string;
};

export const fetchLatestRemoteDiagnosticsReport = async (params: {
  githubRepo: string; // "owner/repo"
  branch?: string | null;
}) => {
  const ref = safeTrim(params.branch) || "main";
  const supabase = await ensureSupabaseClient();

  const { data, error } = await supabase
    .from("diagnostics_reports")
    .select(
      "id,github_repo,branch,status,project_id,workflow_run_id,commit_sha,errors,created_at",
    )
    .eq("github_repo", params.githubRepo)
    .eq("branch", ref)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as RemoteDiagnosticsReport | null;
};
