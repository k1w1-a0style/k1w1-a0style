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
  fix?: { label: string; patch: Record<string, unknown> };
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
    hasPackageJson,
    hasLinkWorkflow,
    hasTriggeredBuildWorkflow,
  ] = await Promise.all([
    fileExists(params.owner, params.repo, "app.config.js", ref),
    fileExists(params.owner, params.repo, "app.config.ts", ref),
    fileExists(params.owner, params.repo, "app.json", ref),
    fileExists(params.owner, params.repo, "eas.json", ref),
    fileExists(params.owner, params.repo, "eas-project.json", ref),
    fileExists(params.owner, params.repo, "package.json", ref),
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

  // --- EAS profiles (3 flows) & APK-only ---
  let easJson: any = null;
  if (hasEasJson) {
    try {
      easJson = await readJsonFile<any>(params.owner, params.repo, "eas.json", ref);
    } catch (e: any) {
      checks.push({
        id: "repo.easJson.parse",
        title: "eas.json ist parsebar",
        status: "fail",
        fixHint: e?.message || "eas.json konnte nicht gelesen/geparst werden.",
      });
    }
  }

  const profiles: Array<"development" | "preview" | "production"> = [
    "development",
    "preview",
    "production",
  ];

  const profileLabel = (p: string) => (p === "production" ? "full (production)" : p);

  for (const prof of profiles) {
    const p = easJson?.build?.[prof];

    if (!p) {
      checks.push({
        id: `repo.easProfile.${prof}`,
        title: `EAS Profil vorhanden: ${profileLabel(prof)}`,
        status: "fail",
        fixHint:
          "Profil fehlt in eas.json. In-App: Repo-Projektdateien aktualisieren (Templates/Push) oder CI AutoFix nutzen.",
      });
      continue;
    }

    // APK-only: enforce android.buildType=apk
    const btRaw = p?.android?.buildType;
    const bt = typeof btRaw === "string" ? btRaw.toLowerCase().trim() : "";
    const btOk = bt === "apk" || bt === "";
    // (empty means EAS default; we still prefer explicit apk)
    checks.push({
      id: `repo.easBuildType.${prof}`,
      title: `Android BuildType (APK-only): ${profileLabel(prof)}`,
      status: btOk ? (bt === "apk" ? "pass" : "warn") : "fail",
      fixHint: btOk
        ? bt === "apk"
          ? undefined
          : 'Setze in eas.json: build.' + prof + '.android.buildType = "apk".'
        : `BuildType ist "${btRaw}". Erwartet: "apk".`,
    });

    if (prof === "development") {
      const devClient = p?.developmentClient === true;
      checks.push({
        id: "repo.easDevClientFlag",
        title: "Development Flow: developmentClient=true",
        status: devClient ? "pass" : "warn",
        fixHint: devClient
          ? undefined
          : "Für Development Builds sollte developmentClient=true gesetzt sein (sonst kein Dev-Client APK).",
      });
    }
  }

  // Development Flow: expo-dev-client dependency recommended/required
  if (hasPackageJson) {
    try {
      const pkg = await readJsonFile<any>(params.owner, params.repo, "package.json", ref);
      const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
      const hasDevClient = typeof deps["expo-dev-client"] === "string";
      checks.push({
        id: "repo.dep.expoDevClient",
        title: "Dependency: expo-dev-client (für Development Flow)",
        status: hasDevClient ? "pass" : "warn",
        fixHint: hasDevClient
          ? undefined
          : "Für development profile: expo-dev-client als dependency hinzufügen (sonst EAS dev-client Schritte failen).",
      });
    } catch {
      checks.push({
        id: "repo.dep.expoDevClient",
        title: "Dependency: expo-dev-client (für Development Flow)",
        status: "warn",
        fixHint: "package.json konnte nicht gelesen werden.",
      });
    }
  }


  // --- EAS projectId (needed for non-interactive builds) ---
  let projectId = "";
  let projectIdSource: "eas-project.json" | "app.json" | "app.config" | "" = "";
  let projectIdOk = false;

  if (hasEasProjectJson) {
    try {
      const data = await readJsonFile<{ projectId?: string }>(
        params.owner,
        params.repo,
        "eas-project.json",
        ref,
      );
      const candidate = safeTrim(data?.projectId);
      if (candidate && isUuid(candidate)) {
        projectId = candidate;
        projectIdOk = true;
        projectIdSource = "eas-project.json";
      }
    } catch {
      // ignore; we'll try other sources
    }
  }

  if (!projectIdOk && hasAppJson) {
    try {
      const appJson = await readJsonFile<any>(params.owner, params.repo, "app.json", ref);
      const candidate = safeTrim(appJson?.expo?.extra?.eas?.projectId);
      if (candidate && isUuid(candidate)) {
        projectId = candidate;
        projectIdOk = true;
        projectIdSource = "app.json";
      }
    } catch {
      // ignore
    }
  }

  if (!projectIdOk && (hasAppConfigJs || hasAppConfigTs)) {
    try {
      const path = hasAppConfigJs ? "app.config.js" : "app.config.ts";
      const text = await getRepoFileText({ owner: params.owner, repo: params.repo, path, ref });
      const m1 = text.match(/projectId[^0-9a-fA-F]{0,64}([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/);
      const m2 = !m1 ? text.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/) : null;
      const candidate = safeTrim((m1?.[1] ?? m2?.[1]) as any);
      if (candidate && isUuid(candidate)) {
        projectId = candidate;
        projectIdOk = true;
        projectIdSource = "app.config";
      }
    } catch {
      // ignore
    }
  }

  checks.push({
    id: "repo.easProjectId",
    title: "EAS projectId vorhanden (non-interactive)",
    status: projectIdOk ? "pass" : "fail",
    details: projectIdOk
      ? `projectId: ${projectId} (source: ${projectIdSource})`
      : undefined,
    fixHint: projectIdOk
      ? undefined
      : "EAS projectId fehlt → In-App: RepoScreen 'EAS Projekt erstellen/verbinden' ausführen oder Workflow 'eas-link.yml' starten.",
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
