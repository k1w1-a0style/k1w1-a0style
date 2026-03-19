// lib/diagnostics/buildPipelineDiagnostics.ts
// REFACTORED: types/helpers → diagnosticTypes.ts, remote → remoteDiagnostics.ts

import {
  getEdgeAdminKey,
  getExpoToken,
  getGitHubToken,
  getRepoFileText,
  listRepoSecretNames,
} from "../../infra/github/githubService";

import { safeTrim, isUuid, fileExists, readJsonFile } from "./diagnosticTypes";
import type { DiagnosticCheck } from "./diagnosticTypes";
export type { DiagnosticStatus, DiagnosticFix, DiagnosticCheck } from "./diagnosticTypes";
export { triggerRemoteDiagnostics, fetchLatestRemoteDiagnosticsReport } from "./remoteDiagnostics";
export type { RemoteDiagnosticsReport } from "./remoteDiagnostics";
import {
  classifyVerificationError,
  normalizeVerificationContract,
} from "../status/verificationContract";


export type BuildPipelineDiagnosticsDeps = {
  getGitHubToken?: typeof getGitHubToken;
  getExpoToken?: typeof getExpoToken;
  getEdgeAdminKey?: typeof getEdgeAdminKey;
  fileExists?: typeof fileExists;
  readJsonFile?: typeof readJsonFile;
  getRepoFileText?: typeof getRepoFileText;
  listRepoSecretNames?: typeof listRepoSecretNames;
};


const CANONICAL_EAS_JSON = {
  cli: { version: ">= 10.0.0" },
  build: {
    development: {
      distribution: "internal",
      android: { buildType: "apk", withoutCredentials: true },
    },
    preview: {
      distribution: "internal",
      android: { buildType: "apk", withoutCredentials: true },
    },
    production: {
      android: { buildType: "apk", withoutCredentials: false },
    },
  },
};

const canonicalEasJsonString = () => `${JSON.stringify(CANONICAL_EAS_JSON, null, 2)}
`;

export function describeRepoSecretContract(params: {
  name: string;
  state: "verified" | "missing" | "unknown" | "auth_error" | "stale";
  optional?: boolean;
}): { status: DiagnosticCheck["status"]; fixHint?: string } {
  if (params.state === "verified") return { status: "pass" };
  if (params.state === "missing") {
    return {
      status: params.optional ? "warn" : "fail",
      fixHint: params.optional
        ? `Optional, aber fuer Remote-Checks hilfreich: ${params.name} setzen.`
        : `Secretsync ausführen (${params.name} fehlt).`,
    };
  }
  if (params.state === "auth_error") {
    return {
      status: "warn",
      fixHint: "Secret-Status konnte nicht verifiziert werden: GitHub Token braucht Repo-Admin-/Secrets-Rechte.",
    };
  }
  if (params.state === "stale") {
    return {
      status: "warn",
      fixHint: "Secret-Status ist nicht mehr frisch bestaetigt. Bitte Repo-Secrets erneut prüfen.",
    };
  }
  return {
    status: "warn",
    fixHint: "Secret-Status ist aktuell unklar und konnte nicht sicher verifiziert werden.",
  };
}

const DEFAULT_BUILD_PIPELINE_DIAGNOSTICS_DEPS: Required<BuildPipelineDiagnosticsDeps> = {
  getGitHubToken,
  getExpoToken,
  getEdgeAdminKey,
  fileExists,
  readJsonFile,
  getRepoFileText,
  listRepoSecretNames,
};

export const runBuildPipelineDiagnostics = async (
  params: {
    owner: string;
    repo: string;
    branch?: string | null;
  },
  deps: BuildPipelineDiagnosticsDeps = {},
) => {
  const d = { ...DEFAULT_BUILD_PIPELINE_DIAGNOSTICS_DEPS, ...deps };
  const ref = safeTrim(params.branch);
  if (!ref) {
    throw new Error("Kein Branch ausgewählt.");
  }

  const checks: DiagnosticCheck[] = [];

  // --- Local prerequisites ---
  const [ghToken, expoToken, adminKey] = await Promise.all([
    d.getGitHubToken(),
    d.getExpoToken(),
    d.getEdgeAdminKey(),
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
    d.fileExists(params.owner, params.repo, "app.config.js", ref),
    d.fileExists(params.owner, params.repo, "app.config.ts", ref),
    d.fileExists(params.owner, params.repo, "app.json", ref),
    d.fileExists(params.owner, params.repo, "eas.json", ref),
    d.fileExists(params.owner, params.repo, "eas-project.json", ref),
    d.fileExists(params.owner, params.repo, "package.json", ref),
    d.fileExists(
      params.owner,
      params.repo,
      ".github/workflows/eas-link.yml",
      ref,
    ),
    d.fileExists(
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
    fix:
      expoConfigOk || hasAppConfigJs || hasAppConfigTs
        ? undefined
        : {
            label: "Create minimal Expo config",
            patch: {
              upsert: [
                {
                  path: "app.json",
                  content: `${JSON.stringify({ expo: { name: "CHANGE_ME", slug: "change-me", version: "1.0.0", android: { package: "com.change.me" } } }, null, 2)}
`,
                },
              ],
              explanation:
                "Minimales app.json erzeugt (TODO: name/slug/version/android.package auf reale Werte anpassen).",
            },
          },
  });

  checks.push({
    id: "repo.easJson",
    title: "eas.json vorhanden",
    status: hasEasJson ? "pass" : "fail",
    fixHint: hasEasJson
      ? undefined
      : "eas.json fehlt → Template/Patch anwenden (sonst EAS Profiles fehlen).",
    fix: hasEasJson
      ? undefined
      : {
          label: "Apply canonical EAS config",
          patch: {
            upsert: [{ path: "eas.json", content: canonicalEasJsonString() }],
            explanation: "Legt eine kanonische eas.json mit development/preview/production Profilen an.",
          },
        },
  });

  // --- EAS profiles (3 flows) & APK-only ---
  let easJson: any = null;
  if (hasEasJson) {
    easJson = await d.readJsonFile<any>(params.owner, params.repo, "eas.json", ref);
    if (!easJson) {
      checks.push({
        id: "repo.easJson.parse",
        title: "eas.json ist parsebar",
        status: "fail",
        fixHint: "eas.json konnte nicht gelesen/geparst werden.",
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
        fix: {
          label: "Apply canonical EAS config",
          patch: {
            jsonMerge: [
              {
                path: "eas.json",
                patch: { build: { [prof]: (CANONICAL_EAS_JSON.build as any)[prof] } },
                createIfMissing: true,
              },
            ],
            explanation: `Ergänzt das fehlende build.${prof} Profil in eas.json (additiv).`,
          },
        },
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
      details: btOk
        ? bt === "apk"
          ? undefined
          : `build.${prof}.android.buildType ist nicht gesetzt – bitte explizit "apk" setzen.`
        : `BuildType ist "${btRaw}". Erwartet: "apk".`,
      fixHint: btOk
        ? bt === "apk"
          ? undefined
          : 'Setze in eas.json: build.' + prof + '.android.buildType = "apk".'
        : `Setze build.${prof}.android.buildType auf "apk".`,
      fix:
        bt === "apk"
          ? undefined
          : {
              label: `Setze ${prof}.android.buildType auf "apk"`,
              patch: {
                jsonMerge: [
                  {
                    path: "eas.json",
                    patch: { build: { [prof]: { android: { buildType: "apk" } } } },
                    createIfMissing: true,
                  },
                ],
                explanation:
                  "APK-only: Der In-App Builder unterstützt ausschließlich installierbare APKs.",
              },
            },
    });

    // --- Android signing strategy (CI-safe) ---
    // Hintergrund: In CI läuft `eas build --non-interactive`. Falls auf Expo/EAS noch
    // kein Android Keystore existiert, schlägt der Build fehl (EAS kann in non-interactive
    // keinen neuen Keystore generieren).
    // Für development/preview (interne APKs) ist `android.withoutCredentials=true` der
    // sauberste Weg, damit Builds ohne Keystore laufen.
    // Production bleibt bewusst signiert (ohneCredentials=false).
    const withoutCreds = p?.android?.withoutCredentials === true;

    if (prof === "production") {
      checks.push({
        id: `repo.easAndroidWithoutCreds.${prof}`,
        title: `Android Signierung: ${profileLabel(prof)}`,
        status: withoutCreds ? "warn" : "pass",
        details: withoutCreds
          ? "android.withoutCredentials=true ist aktiv – Production Builds sollten signiert werden (Keystore nötig)."
          : undefined,
        fixHint: withoutCreds
          ? "Entferne android.withoutCredentials oder setze es auf false, damit Production signiert ist."
          : undefined,
        fix: withoutCreds
          ? {
              label: "Deaktiviere withoutCredentials (production)",
              patch: {
                jsonMerge: [
                  {
                    path: "eas.json",
                    patch: { build: { production: { android: { withoutCredentials: false } } } },
                    createIfMissing: true,
                  },
                ],
                explanation:
                  "Production Builds benötigen Signing Credentials (Keystore). withoutCredentials ist nur für interne Builds gedacht.",
              },
            }
          : undefined,
      });
    } else {
      checks.push({
        id: `repo.easAndroidWithoutCreds.${prof}`,
        title: `Android Signierung (CI-safe): ${profileLabel(prof)}`,
        status: withoutCreds ? "pass" : "warn",
        details: withoutCreds
          ? "withoutCredentials=true → kein Keystore nötig (ideal für CI / interne APKs)."
          : "withoutCredentials fehlt → CI non-interactive kann beim ersten Build am Keystore scheitern.",
        fixHint: withoutCreds
          ? undefined
          : "Empfohlen: build." +
            prof +
            ".android.withoutCredentials=true (wenn du keine signierten internen APKs brauchst).",
        fix: withoutCreds
          ? undefined
          : {
              label: `Setze ${prof}.android.withoutCredentials=true`,
              patch: {
                jsonMerge: [
                  {
                    path: "eas.json",
                    patch: { build: { [prof]: { android: { withoutCredentials: true } } } },
                    createIfMissing: true,
                  },
                ],
                explanation:
                  "Damit development/preview Builds in CI ohne vorherige Keystore-Erstellung zuverlässig laufen.",
              },
            },
      });
    }

    if (prof === "development") {
      const devClient = p?.developmentClient === true;
      const dist = typeof p?.distribution === "string" ? String(p.distribution).trim() : "";
      const internalOk = !devClient ? dist === "internal" || dist === "" : true;

      // Development profile must be *coherent*, not necessarily dev-client.
      // - If developmentClient=true: expect dev-client dependency in package.json (checked below)
      // - If developmentClient=false: expect distribution=internal (or empty, but internal is preferred)
      checks.push({
        id: "repo.easDevelopmentCoherent",
        title: "Development Profil konsistent (Dev-Client ODER internal APK)",
        status: devClient || internalOk ? "pass" : "warn",
        details: devClient
          ? "Development-Client Flow aktiv (developmentClient=true)."
          : internalOk
            ? "Development ist als internal APK konfiguriert (ohne Dev-Client)."
            : "developmentClient=false aber distribution ist nicht internal.",
        fixHint: devClient
          ? undefined
          : internalOk
            ? undefined
            : "Wenn developmentClient=false ist, sollte distribution=internal gesetzt sein.",
        fix:
          devClient || internalOk
            ? undefined
            : {
                label: "Setze distribution=internal (development)",
                patch: {
                  jsonMerge: [
                    {
                      path: "eas.json",
                      patch: { build: { development: { distribution: "internal" } } },
                      createIfMissing: true,
                    },
                  ],
                  explanation:
                    "Development ohne Dev-Client sollte als internes APK gebaut werden (distribution=internal).",
                },
              },
      });

      // Optional: offer a positive fix to enable dev-client flow (only if currently off)
      if (!devClient) {
        checks.push({
          id: "repo.easEnableDevClientFlow",
          title: "Optional: Development-Client Flow aktivieren",
          status: "info",
          details:
            "Wenn du im Dev-Mode den echten Dev-Client nutzen willst, aktiviere developmentClient=true (und stelle sicher, dass expo-dev-client als Dependency existiert).",
          fix: {
            label: "Setze developmentClient=true (development)",
            patch: {
              jsonMerge: [
                {
                  path: "eas.json",
                  patch: {
                    build: {
                      development: {
                        developmentClient: true,
                        // distribution is ignored by EAS when dev-client is on, but we keep it unset.
                      },
                    },
                  },
                  createIfMissing: true,
                },
              ],
              explanation:
                "Aktiviert den Development-Client Flow. Dafür wird in der Regel expo-dev-client als Dependency benötigt.",
            },
          },
        });
      }
    }
  }

  // Development Flow: expo-dev-client dependency recommended/required
  if (hasPackageJson) {
    try {
      const pkg = await d.readJsonFile<any>(params.owner, params.repo, "package.json", ref);
      const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
      const hasDevClient = typeof deps["expo-dev-client"] === "string";

      // Only required when developmentClient=true in eas.json
      const devClientEnabled = easJson?.build?.development?.developmentClient === true;

      checks.push({
        id: "repo.dep.expoDevClient",
        title: "Dependency: expo-dev-client (für Development Flow)",
        status: hasDevClient ? "pass" : devClientEnabled ? "warn" : "pass",
        details: hasDevClient
          ? undefined
          : devClientEnabled
            ? "developmentClient=true ist aktiv, aber expo-dev-client fehlt im package.json."
            : "developmentClient ist aus – expo-dev-client ist optional.",
        fixHint:
          hasDevClient
            ? undefined
            : devClientEnabled
              ? "Entweder expo-dev-client hinzufügen ODER developmentClient=false verwenden (internal APK)."
              : undefined,
        fix:
          hasDevClient
            ? undefined
            : devClientEnabled
              ? {
                  label: "Stelle development Profil auf internal APK (ohne Dev-Client)",
                  patch: {
                    jsonMerge: [
                      {
                        path: "eas.json",
                        patch: {
                          build: {
                            development: {
                              developmentClient: false,
                              distribution: "internal",
                              android: { buildType: "apk" },
                            },
                          },
                        },
                        createIfMissing: true,
                      },
                    ],
                    explanation:
                      "Damit Dev-Builds ohne expo-dev-client zuverlässig laufen, wird das development Profil als internes APK konfiguriert.",
                  },
                }
              : undefined,
      });
    } catch {
      checks.push({
        id: "repo.dep.expoDevClient.read",
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
      const data = await d.readJsonFile<{ projectId?: string }>(
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
      const appJson = await d.readJsonFile<any>(params.owner, params.repo, "app.json", ref);
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
      const text = await d.getRepoFileText({ owner: params.owner, repo: params.repo, path, ref });
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
    fix: projectIdOk
      ? undefined
      : {
          label: "EAS Projekt verbinden (Auto)",
          workflowDispatch: {
            workflowFileName: "eas-link.yml",
            ref,
            fallbackPatch: {
              upsert: [
                {
                  path: ".github/workflows/eas-link.yml",
                  content:
                    'name: EAS Link\non:\n  workflow_dispatch:\njobs:\n  link:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo "eas-link placeholder"\n',
                },
              ],
              explanation:
                "Fehlenden Workflow eas-link.yml anlegen, damit EAS-Link Auto-Fix dispatchbar ist.",
            },
          },
        },
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
    const names = await d.listRepoSecretNames(params.owner, params.repo);
    const hasExpoTokenSecret = names.includes("EXPO_TOKEN");
    const hasSupabaseUrlSecret = names.includes("SUPABASE_URL");
    const hasSupabaseServiceRoleSecret = names.includes(
      "SUPABASE_SERVICE_ROLE_KEY",
    );
    const expoTokenContract = normalizeVerificationContract({
      configured: hasExpoTokenSecret,
    });
    const supabaseUrlContract = normalizeVerificationContract({
      configured: hasSupabaseUrlSecret,
    });
    const supabaseServiceRoleContract = normalizeVerificationContract({
      configured: hasSupabaseServiceRoleSecret,
    });
    const expoTokenCopy = describeRepoSecretContract({
      name: "EXPO_TOKEN",
      state: expoTokenContract.state,
    });
    const supabaseUrlCopy = describeRepoSecretContract({
      name: "SUPABASE_URL",
      state: supabaseUrlContract.state,
      optional: true,
    });
    const serviceRoleCopy = describeRepoSecretContract({
      name: "SUPABASE_SERVICE_ROLE_KEY",
      state: supabaseServiceRoleContract.state,
      optional: true,
    });

    checks.push({
      id: "repo.secret.expoToken",
      title: "Repo Secret vorhanden: EXPO_TOKEN",
      status: expoTokenCopy.status,
      fixHint: expoTokenCopy.fixHint,
    });

    checks.push({
      id: "repo.secret.supabaseUrl",
      title: "Repo Secret vorhanden: SUPABASE_URL",
      status: supabaseUrlCopy.status,
      fixHint: supabaseUrlCopy.fixHint,
    });

    checks.push({
      id: "repo.secret.supabaseServiceRole",
      title: "Repo Secret vorhanden: SUPABASE_SERVICE_ROLE_KEY",
      status: serviceRoleCopy.status,
      fixHint: serviceRoleCopy.fixHint,
    });
  } catch (e: any) {
    const errorState = classifyVerificationError({ error: e });
    const secretListCopy = describeRepoSecretContract({
      name: "repo secrets",
      state: errorState,
      optional: true,
    });
    checks.push({
      id: "repo.secret.list",
      title: "Repo Secrets abrufbar",
      status: secretListCopy.status,
      details: e?.message || "Secrets konnten nicht gelesen werden.",
      fixHint: secretListCopy.fixHint,
    });
  }

  // --- Optional: app.config.js should read eas-project.json ---
  if (hasAppConfigJs) {
    try {
      const appConfig = await d.getRepoFileText({
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
        fix: undefined,
      });
    } catch {
      // ignore
    }
  }

  return { ref, checks };
};
