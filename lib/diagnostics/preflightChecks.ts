// lib/diagnostics/preflightChecks.ts

import type { ProjectFile } from "../../contexts/types";
import type {
  PreflightCheck,
  PreflightCheckResult,
  PreflightPatch,
  PreflightSeverity,
  PreflightStatus,
  PreflightTarget,
} from "./preflightTypes";
import { safeTruncate, sanitizeJsonString, sanitizeText } from "./sanitize";

const byPath = (files: ProjectFile[]) => {
  const map = new Map<string, ProjectFile>();
  for (const f of files) map.set(normalizePath(f.path), f);
  return map;
};

const normalizePath = (p: string) =>
  p.replace(/\\/g, "/").replace(/^\.?\//, "");

const has = (m: Map<string, ProjectFile>, p: string) => m.has(normalizePath(p));

const getText = (m: Map<string, ProjectFile>, p: string) =>
  m.get(normalizePath(p))?.content ?? "";

const ok = (
  res: Omit<PreflightCheckResult, "status"> & { status?: PreflightStatus },
): PreflightCheckResult => ({
  status: res.status ?? "pass",
  ...res,
});

function mkFix(
  upsert: Array<{ path: string; content: string }>,
  del: string[] = [],
  label = "Fix anwenden",
): PreflightPatch {
  return { upsert, delete: del, explanation: label };
}

function mkJsonFix(
  jsonMerge: Array<{ path: string; patch: unknown; createIfMissing?: boolean }>,
  del: string[] = [],
  label = "Fix anwenden",
): PreflightPatch {
  return { jsonMerge, delete: del, explanation: label };
}

function existsAny(
  m: Map<string, ProjectFile>,
  paths: string[],
): string | null {
  for (const p of paths) if (has(m, p)) return normalizePath(p);
  return null;
}

function parseJson<T = any>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function statusBySeverity(sev: PreflightSeverity): PreflightStatus {
  return sev === "critical"
    ? "fail"
    : sev === "high"
      ? "fail"
      : sev === "normal"
        ? "warn"
        : "warn";
}

// --- Checks

const checkPackageJson: PreflightCheck = {
  id: "core-package-json",
  title: "package.json vorhanden",
  severity: "critical",
  run(files) {
    const m = byPath(files);
    if (has(m, "package.json")) {
      const pkg = parseJson(getText(m, "package.json"));
      if (!pkg || typeof pkg !== "object") {
        return ok({
          id: this.id,
          title: this.title,
          severity: this.severity,
          status: "fail",
          message: "package.json ist keine gültige JSON.",
        });
      }
      return ok({ id: this.id, title: this.title, severity: this.severity });
    }

    const starter = {
      name: "my-app",
      version: "1.0.0",
      private: true,
      main: "index.js",
      scripts: {
        start: "expo start",
        android: "expo run:android",
      },
      dependencies: {
        expo: "^54.0.0",
        react: "18.2.0",
        "react-native": "0.78.0",
      },
    };
    return {
      id: this.id,
      title: this.title,
      severity: this.severity,
      status: "fail",
      message: "package.json fehlt im Projekt.",
      fix: {
        patch: mkFix(
          [
            {
              path: "package.json",
              content: JSON.stringify(starter, null, 2) + "\n",
            },
          ],
          [],
          "package.json erzeugen",
        ),
      },
    };
  },
};

const checkEntryPoint: PreflightCheck = {
  id: "entry-point",
  title: "Entry-Point / main vorhanden",
  severity: "high",
  run(files) {
    const m = byPath(files);
    const pkg = parseJson<any>(getText(m, "package.json")) ?? {};
    const main =
      typeof pkg.main === "string" && pkg.main.trim()
        ? pkg.main.trim()
        : "index.js";
    const mainNorm = normalizePath(main);
    const indexOk =
      has(m, mainNorm) ||
      has(m, "index.js") ||
      has(m, "App.tsx") ||
      has(m, "App.js");
    if (indexOk) {
      return ok({ id: this.id, title: this.title, severity: this.severity });
    }

    const stub = `import { registerRootComponent } from 'expo';\nimport App from './App';\n\nregisterRootComponent(App);\n`;
    return {
      id: this.id,
      title: this.title,
      severity: this.severity,
      status: "fail",
      message: `Kein Entry-File gefunden ("${mainNorm}" / index.js / App.tsx).`,
      fix: {
        patch: {
          upsert: [{ path: "index.js", content: stub }],
          jsonMerge: [
            {
              path: "package.json",
              patch: { main: "index.js" },
              createIfMissing: false,
            },
          ],
          explanation: "index.js stub anlegen + package.json main setzen",
        },
      },
    };
  },
};

const checkEasProfiles: PreflightCheck = {
  id: "eas-profiles",
  title: "EAS Profile Android (APK vs AAB)",
  severity: "normal",
  run(files, target) {
    if (target.mode !== "eas") {
      return ok({
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "pass",
        message: "Nicht relevant (Expo Go).",
      });
    }
    const m = byPath(files);
    if (!has(m, "eas.json")) {
      const template = {
        build: {
          development: { developmentClient: true, distribution: "internal" },
          preview: { distribution: "internal", android: { buildType: "apk" } },
          production: { android: { buildType: "aab" } },
        },
      };
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: statusBySeverity(this.severity),
        message: "eas.json fehlt. Ohne Profile können Builds schief laufen.",
        fix: {
          patch: mkFix(
            [
              {
                path: "eas.json",
                content: JSON.stringify(template, null, 2) + "\n",
              },
            ],
            [],
            "eas.json erzeugen",
          ),
        },
      };
    }

    const eas = parseJson<any>(getText(m, "eas.json"));
    if (!eas || typeof eas !== "object") {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message: "eas.json ist keine gültige JSON. Bitte prüfen.",
      };
    }

    const profile = target.profile;
    const p = eas?.build?.[profile];
    if (!p) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message: `eas.json hat kein build.${profile} Profil.`,
      };
    }

    // lightweight hint: preview should be APK for easy install; production typically AAB
    const buildType = p?.android?.buildType;
    if (profile === "preview" && buildType && buildType !== "apk") {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message: `preview.android.buildType ist "${buildType}" – für 1‑Click Install ist "apk" oft besser.`,
      };
    }
    if (profile === "production" && buildType && buildType !== "aab") {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message: `production.android.buildType ist "${buildType}" – für Play Store ist "aab" üblich.`,
      };
    }

    return ok({ id: this.id, title: this.title, severity: this.severity });
  },
};

const checkAssetsExist: PreflightCheck = {
  id: "assets-exist",
  title: "Assets referenced existieren",
  severity: "normal",
  run(files) {
    const m = byPath(files);
    const cfgPath = existsAny(m, [
      "app.json",
      "app.config.js",
      "app.config.ts",
      "app.config.json",
    ]);
    if (!cfgPath) {
      return ok({
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message: "Keine app.json/app.config.* gefunden.",
      });
    }
    const cfgText = getText(m, cfgPath);
    const iconMatches = [...cfgText.matchAll(/"icon"\s*:\s*"([^"]+)"/g)]
      .map((x) => x[1])
      .filter(Boolean);
    const splashMatches = [...cfgText.matchAll(/"image"\s*:\s*"([^"]+)"/g)]
      .map((x) => x[1])
      .filter(Boolean);
    const candidates = [...new Set([...iconMatches, ...splashMatches])]
      .map((p) => normalizePath(p.replace(/^\.\//, "")))
      .filter((p) => p && !p.startsWith("http"));
    if (!candidates.length) {
      return ok({
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "pass",
        message: "Keine Asset-Refs gefunden.",
      });
    }
    const missing = candidates.filter((p) => !has(m, p));
    if (!missing.length)
      return ok({ id: this.id, title: this.title, severity: this.severity });
    return {
      id: this.id,
      title: this.title,
      severity: this.severity,
      status: "warn",
      message: `Asset-Dateien fehlen (${missing.length}).`,
      details: missing.slice(0, 50),
    };
  },
};

// --- Extra quality checks (v8.9) ---

const checkLockfileConsistency: PreflightCheck = {
  id: "lockfile-consistency",
  title: "Lockfile Konsistenz",
  severity: "normal",
  run(files) {
    const m = byPath(files);
    if (!has(m, "package.json")) {
      return ok({ id: this.id, title: this.title, severity: this.severity });
    }

    const hasNpm = has(m, "package-lock.json");
    const hasYarn = has(m, "yarn.lock");
    const hasPnpm = has(m, "pnpm-lock.yaml");

    const lockCount = [hasNpm, hasYarn, hasPnpm].filter(Boolean).length;

    if (lockCount === 0) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message:
          "Kein Lockfile gefunden (package-lock.json / yarn.lock / pnpm-lock.yaml). Builds können dadurch inkonsistent werden.",
      };
    }

    if (lockCount > 1) {
      const details = [
        hasNpm ? "package-lock.json" : null,
        hasYarn ? "yarn.lock" : null,
        hasPnpm ? "pnpm-lock.yaml" : null,
      ].filter(Boolean) as string[];

      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message: `Mehrere Lockfiles gefunden (${details.length}). Nutze nur EINEN Package Manager.`,
        details,
      };
    }

    return ok({ id: this.id, title: this.title, severity: this.severity });
  },
};

const checkExpoConfig: PreflightCheck = {
  id: "expo-config-validation",
  title: "Expo Config Validation",
  severity: "high",
  run(files) {
    const m = byPath(files);

    const hasAppJson = has(m, "app.json");
    const hasAppConfigJs = has(m, "app.config.js");

    if (!hasAppJson && !hasAppConfigJs) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "fail",
        message:
          "Keine app.json oder app.config.js gefunden (Expo Config fehlt).",
      };
    }

    if (hasAppConfigJs && !hasAppJson) {
      // JS config exists (cannot reliably parse here) — treat as pass.
      return ok({
        id: this.id,
        title: this.title,
        severity: this.severity,
        message: "app.config.js vorhanden",
      });
    }

    const raw = getText(m, "app.json");
    const cfg = parseJson<any>(raw);
    if (!cfg) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "fail",
        message: "app.json ist keine gültige JSON.",
      };
    }

    const expo = cfg.expo;
    if (!expo || typeof expo !== "object") {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "fail",
        message: 'app.json fehlt "expo" Objekt.',
      };
    }

    const issues: string[] = [];
    if (!expo.name) issues.push("expo.name fehlt");
    if (!expo.slug) issues.push("expo.slug fehlt");
    if (!expo.version) issues.push("expo.version fehlt");
    if (expo.ios && !expo.ios.bundleIdentifier)
      issues.push("expo.ios.bundleIdentifier fehlt");
    if (expo.android && !expo.android.package)
      issues.push("expo.android.package fehlt");

    if (issues.length) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message: `Expo Config unvollständig (${issues.length} Feld(er) fehlen).`,
        details: issues,
      };
    }

    return ok({ id: this.id, title: this.title, severity: this.severity });
  },
};

const checkGitignorePresent: PreflightCheck = {
  id: "gitignore-present",
  title: ".gitignore vorhanden",
  severity: "normal",
  run(files) {
    const m = byPath(files);

    if (has(m, ".gitignore")) {
      const content = getText(m, ".gitignore");
      const misses: string[] = [];
      if (!/\bnode_modules\b/i.test(content)) misses.push("node_modules/");
      if (!/\b\.expo\b/i.test(content)) misses.push(".expo/");
      if (!/\b(dist|build|web-build)\b/i.test(content))
        misses.push("dist/ oder build/");
      if (!/\.env/i.test(content)) misses.push(".env*");

      if (misses.length) {
        return {
          id: this.id,
          title: this.title,
          severity: this.severity,
          status: "warn",
          message: ".gitignore wirkt unvollständig (häufige Einträge fehlen).",
          details: misses,
        };
      }

      return ok({ id: this.id, title: this.title, severity: this.severity });
    }

    const template = `# Dependencies
node_modules/

# Expo
.expo/
dist/
web-build/

# Native
android/
ios/
*.jks
*.p8
*.p12
*.key
*.mobileprovision

# Metro
.metro-health-check*

# Debug
npm-debug.*
yarn-debug.*
yarn-error.*

# Misc
.DS_Store

# Env
.env
.env*.local
`;

    return {
      id: this.id,
      title: this.title,
      severity: this.severity,
      status: "fail",
      message: ".gitignore fehlt im Projekt.",
      fix: {
        patch: mkFix(
          [{ path: ".gitignore", content: template }],
          [],
          ".gitignore erzeugen",
        ),
      },
    };
  },
};

const checkReactNativeCompatibility: PreflightCheck = {
  id: "rn-react-compat",
  title: "React / React Native Kompatibilität",
  severity: "high",
  run(files) {
    const m = byPath(files);
    if (!has(m, "package.json")) {
      return ok({ id: this.id, title: this.title, severity: this.severity });
    }
    const pkg = parseJson<any>(getText(m, "package.json")) ?? {};
    const deps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    } as Record<string, string>;
    const react = deps.react;
    const rn = deps["react-native"];

    if (!react || !rn) {
      return ok({ id: this.id, title: this.title, severity: this.severity });
    }

    const reactM = String(react).match(/(\d+)\.(\d+)/);
    const rnM = String(rn).match(/0\.(\d+)/);
    if (!reactM || !rnM) {
      return ok({ id: this.id, title: this.title, severity: this.severity });
    }

    const reactMajor = Number(reactM[1]);
    const reactMinor = Number(reactM[2]);
    const rnMinor = Number(rnM[1]);

    // Conservative, heuristics-based guidance (not perfect).
    // React 18.3+ tends to require RN 0.75+ in modern stacks.
    if (reactMajor === 18 && reactMinor >= 3 && rnMinor < 75) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "fail",
        message: `Mögliche Inkompatibilität: react ${react} mit react-native ${rn}. Empfohlen: RN >= 0.75 bei React 18.3+.`,
      };
    }

    return ok({ id: this.id, title: this.title, severity: this.severity });
  },
};

const checkSdkConsistency: PreflightCheck = {
  id: "expo-sdk-consistency",
  title: "Expo SDK Konsistenz (light)",
  severity: "low",
  run(files) {
    const m = byPath(files);
    if (!has(m, "package.json")) {
      return ok({
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "pass",
      });
    }
    const pkg = parseJson<any>(getText(m, "package.json")) ?? {};
    const deps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
    const expo = deps.expo as string | undefined;
    const rn = deps["react-native"] as string | undefined;
    if (!expo) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message:
          "expo dependency fehlt. Für Expo-Projekte ist das ungewöhnlich.",
      };
    }
    if (!rn) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message: "react-native dependency fehlt.",
      };
    }
    // Very lightweight: ensure major expo version and RN version are not obviously incompatible
    const expoMajor = Number(String(expo).match(/(\d+)/)?.[1] ?? "0");
    const rnMajorMinor = String(rn).match(/(\d+)\.(\d+)/);
    if (expoMajor >= 54 && rnMajorMinor) {
      const rnMajor = Number(rnMajorMinor[1]);
      // Expo SDK 54 uses RN 0.78 (at least around). If wildly different, warn.
      if (rnMajor !== 0) {
        // ignore, rnMajor for RN is 0
      }
      const rnMinor = Number(rnMajorMinor[2]);
      if (Math.abs(rnMinor - 78) >= 6) {
        return {
          id: this.id,
          title: this.title,
          severity: this.severity,
          status: "warn",
          message: `expo ${expo} und react-native ${rn} wirken ungewöhnlich kombiniert.`,
        };
      }
    }
    return ok({ id: this.id, title: this.title, severity: this.severity });
  },
};

const checkQualityScriptsDeps: PreflightCheck = {
  id: "quality-scripts",
  title: "Quality Scripts: TS/ESLint Dependencies",
  severity: "normal",
  run(files) {
    const m = byPath(files);
    const pkg = parseJson<any>(getText(m, "package.json"));
    if (!pkg) {
      return ok({
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "pass",
      });
    }
    const scripts: Record<string, string> = pkg.scripts ?? {};
    const deps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };

    const wantsTS = Object.values(scripts).some((s) =>
      /\btsc\b|typecheck/i.test(String(s)),
    );
    const wantsEslint = Object.values(scripts).some((s) =>
      /\beslint\b/i.test(String(s)),
    );

    const missing: string[] = [];
    if (wantsTS && !deps.typescript) missing.push("typescript");
    if (wantsEslint && !deps.eslint) missing.push("eslint");

    if (!missing.length)
      return ok({ id: this.id, title: this.title, severity: this.severity });
    return {
      id: this.id,
      title: this.title,
      severity: this.severity,
      status: "warn",
      message: `Scripts vorhanden, aber Dependencies fehlen: ${missing.join(", ")}.`,
      fix: {
        patch: mkJsonFix(
          [
            {
              path: "package.json",
              patch: {
                devDependencies: Object.fromEntries(
                  missing.map((d) => [d, "*"]),
                ),
              },
              createIfMissing: false,
            },
          ],
          [],
          "Fehlende devDependencies ergänzen",
        ),
      },
    };
  },
};

// --- GitHub Actions Workflow Security: Service Role Key Leak Detection ---
// This is intentionally conservative (single-line KEY: VALUE only) to avoid pulling a YAML parser into the app.
// It targets the common footgun: hardcoded Supabase *service role* keys inside workflow files.
// Safe patterns are GitHub expressions like ${{ secrets.X }} / ${{ env.X }} as well as shell env references ($VAR / ${VAR}).

const GH_EXPR_REF_RE =
  /^\$\{\{\s*(secrets|env|vars|inputs)\.[A-Za-z0-9_]+\s*\}\}$/i;
const SHELL_ENV_REF_RE = /^\$\{?[A-Za-z_][A-Za-z0-9_]*\}?$/;
const JWT_LIKE_RE =
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/;

function stripInlineYamlComment(value: string): string {
  const v = value.trim();
  if (!v) return v;
  // If quoted, keep as-is (comment markers inside quotes are valid content)
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  )
    return v;
  // YAML comment starts with # preceded by whitespace
  return v.replace(/\s+#.*$/, "").trim();
}

function unquoteYamlScalar(value: string): string {
  const v = value.trim();
  return v.replace(/^["']|["']$/g, "");
}

function scanWorkflowServiceRoleUsage(text: string): {
  leaks: string[];
  fixed?: string;
} {
  const lines = (text ?? "").split(/\r?\n/);
  const outLines = [...lines];
  const leaks: string[] = [];

  // indent + KEY: VALUE (single-line only)
  const assignRe =
    /^([\t -]*)?([A-Za-z0-9_]*SERVICE_ROLE[A-Za-z0-9_]*)\s*:\s*(.+?)\s*$/i;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const m = raw.match(assignRe);
    if (!m) continue;

    const indent = m[1] ?? "";
    const key = m[2] ?? "";
    const valueRaw = m[3] ?? "";
    const valueNoComment = stripInlineYamlComment(valueRaw);

    // allow GitHub expression refs and shell env refs as "safe"
    const valTrim = valueNoComment.trim();
    if (GH_EXPR_REF_RE.test(valTrim) || SHELL_ENV_REF_RE.test(valTrim))
      continue;

    const unquoted = unquoteYamlScalar(valTrim);

    const looksSecret =
      JWT_LIKE_RE.test(unquoted) ||
      (unquoted.length >= 32 && !/\s/.test(unquoted));

    if (!looksSecret) continue;

    leaks.push(`${key} (line ${i + 1})`);

    // Auto-fix: replace value with GitHub secrets reference (keep indentation)
    outLines[i] = `${indent ?? ""}${key}: \${{ secrets.${key} }}`;
  }

  const fixed = outLines.join("\n");
  return { leaks, fixed: leaks.length ? fixed : undefined };
}

const checkWorkflowServiceRoleKeyLeak: PreflightCheck = {
  id: "security-workflow-service-role-key",
  title: "Security: Service Role Key Leak in Workflows",
  severity: "high",
  run(files) {
    const m = byPath(files);
    const workflowFiles = files
      .map((f) => normalizePath(f.path))
      .filter((p) => /^(?:\.github\/workflows\/).+\.(yml|yaml)$/i.test(p));

    if (!workflowFiles.length)
      return ok({ id: this.id, title: this.title, severity: this.severity });

    const details: string[] = [];
    const fixes: Array<{ path: string; content: string }> = [];

    for (const p of workflowFiles) {
      const f = m.get(p);
      if (!f) continue;

      const scan = scanWorkflowServiceRoleUsage(f.content ?? "");
      if (!scan.leaks.length) continue;

      details.push(`${p}: ${scan.leaks.join(", ")}`);
      if (scan.fixed) {
        fixes.push({ path: p, content: scan.fixed });
      }
    }

    if (!details.length)
      return ok({ id: this.id, title: this.title, severity: this.severity });

    return {
      id: this.id,
      title: this.title,
      severity: this.severity,
      status: "fail",
      message:
        "Möglicher hardcoded Supabase Service Role Key in GitHub Workflows gefunden. Nutze GitHub Secrets (secrets.*) statt Klartext.",
      details,
      fix: fixes.length
        ? {
            patch: mkFix(
              fixes,
              [],
              "Service Role Key(s) in GitHub Workflows auf secrets.* umstellen",
            ),
          }
        : undefined,
    };
  },
};

const FORBIDDEN_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "Private Keys", re: /BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY/ },
  { label: "Android Keystore", re: /\.jks$|\.keystore$/i },
];

const checkForbiddenFiles: PreflightCheck = {
  id: "security-forbidden-files",
  title: "Security: verbotene/gefährliche Dateien",
  severity: "high",
  run(files) {
    const hits: string[] = [];
    for (const f of files) {
      const p = normalizePath(f.path);
      for (const pat of FORBIDDEN_PATTERNS) {
        if (pat.re.test(p) || pat.re.test(f.content)) {
          hits.push(`${p} (${pat.label})`);
          break;
        }
      }
      // huge file heuristic: content stored in JSON, so large means dangerous anyway
      if (f.content.length > 2_000_000) {
        hits.push(
          `${p} (sehr groß: ${Math.round(f.content.length / 1024 / 1024)}MB in content)`,
        );
      }
    }
    if (!hits.length)
      return ok({ id: this.id, title: this.title, severity: this.severity });
    return {
      id: this.id,
      title: this.title,
      severity: this.severity,
      status: "fail",
      message: "Potentiell gefährliche Dateien/Secrets gefunden.",
      details: hits.slice(0, 50),
    };
  },
};

export const PREFLIGHT_CHECKS: PreflightCheck[] = [
  checkPackageJson,
  checkGitignorePresent,
  checkLockfileConsistency,
  checkEntryPoint,
  checkExpoConfig,
  checkEasProfiles,
  checkSdkConsistency,
  checkReactNativeCompatibility,
  checkWorkflowServiceRoleKeyLeak,
  checkForbiddenFiles,
];

export function buildDiagnosticUploadSnapshot(
  files: ProjectFile[],
  paths: string[],
): Array<{ path: string; content: string; truncated: boolean }> {
  const m = byPath(files);
  const out: Array<{ path: string; content: string; truncated: boolean }> = [];
  for (const pRaw of paths) {
    const p = normalizePath(pRaw);
    const f = m.get(p);
    if (!f) continue;
    const isJson = /\.json$/i.test(p);
    const sanitized = isJson
      ? sanitizeJsonString(f.content)
      : sanitizeText(f.content);
    const { text, truncated } = safeTruncate(sanitized, 20_000);
    out.push({ path: p, content: text, truncated });
  }
  return out;
}
