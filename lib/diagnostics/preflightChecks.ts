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

const FORBIDDEN_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "Private Keys", re: /BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY/ },
  { label: "Android Keystore", re: /\.jks$|\.keystore$/i },
];

const JWT_LIKE_RE =
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/;
const GH_SECRETS_REF_RE = /\$\{\{\s*secrets\.[A-Z0-9_]+\s*\}\}/;

function scanWorkflowServiceRoleUsage(content: string): {
  hasServiceRoleName: boolean;
  leaks: Array<{ line: number; key: string; value: string }>;
  fixed?: string;
} {
  const lines = content.split(/\r?\n/);
  const leaks: Array<{ line: number; key: string; value: string }> = [];
  let hasServiceRoleName = false;

  // Very conservative YAML line parser: KEY: VALUE (single line only)
  const assignRe =
    /^([ \t-]*)?([A-Z0-9_]*SERVICE_ROLE[A-Z0-9_]*)\s*:\s*(.+?)\s*$/;

  let outLines: string[] | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const m = raw.match(assignRe);
    if (!m) continue;

    const indent = m[1] ?? "";
    const key = m[2];
    const value = (m[3] ?? "").trim();

    hasServiceRoleName = true;

    // Safe if it references GitHub Secrets (or uses expression syntax generally)
    if (GH_SECRETS_REF_RE.test(value)) continue;

    // If the value looks like a token/JWT or a long secret, treat as leak.
    const unquoted = value.replace(/^["']|["']$/g, "");
    const looksSecret = JWT_LIKE_RE.test(unquoted) || unquoted.length >= 32;

    if (!looksSecret) continue;

    leaks.push({ line: i + 1, key, value });

    // Build a safe auto-fix: move to GH secrets reference
    if (!outLines) outLines = [...lines];
    outLines[i] = `${indent}${key}: \${{ secrets.${key} }}`;
  }

  return {
    hasServiceRoleName,
    leaks,
    fixed: outLines ? outLines.join("\n") : undefined,
  };
}

const checkServiceRoleKeyLeak: PreflightCheck = {
  id: "security-service-role-key",
  title: "Security: Service Role Key Handling",
  severity: "high",
  run(files) {
    const workflowFiles = files.filter((f) =>
      /^(?:\.github\/workflows\/).+\.(yml|yaml)$/i.test(normalizePath(f.path)),
    );
    if (!workflowFiles.length) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "pass",
        message: "Keine GitHub Workflows gefunden.",
      };
    }

    const leaksDetails: string[] = [];
    let anyMention = false;
    let fixPatch: PreflightPatch | null = null;
    let fixLabel = "Move Service Role keys to GitHub Secrets";

    for (const f of workflowFiles) {
      const p = normalizePath(f.path);
      const scan = scanWorkflowServiceRoleUsage(f.content);
      if (scan.hasServiceRoleName) anyMention = true;

      if (scan.leaks.length) {
        for (const l of scan.leaks) {
          leaksDetails.push(
            `${p}: line ${l.line} (${l.key}) looks like a hardcoded secret`,
          );
        }

        if (scan.fixed && !fixPatch) {
          fixPatch = { upsert: [{ path: p, content: scan.fixed }] };
        }
      }
    }

    if (leaksDetails.length) {
      const res: PreflightCheckResult = {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "fail",
        message:
          "Service Role Key scheint in Workflow-Dateien im Klartext zu stehen. Das ist riskant – nutze GitHub Secrets.",
        details: leaksDetails.slice(0, 50),
        tags: ["security", "supabase", "github-actions"],
      };
      if (fixPatch) {
        res.fix = { label: fixLabel, patch: fixPatch };
      }
      return res;
    }

    if (anyMention) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message:
          "Workflow referenziert Service Role Variablen. Stelle sicher, dass der Key nur über GitHub Secrets kommt (kein Klartext im Repo).",
        tags: ["security", "supabase", "github-actions"],
      };
    }

    return {
      id: this.id,
      title: this.title,
      severity: this.severity,
      status: "pass",
      message: "Kein Service Role Key in Workflows erkannt.",
    };
  },
};

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
  checkEntryPoint,
  checkEasProfiles,
  checkAssetsExist,
  checkQualityScriptsDeps,
  checkSdkConsistency,
  checkServiceRoleKeyLeak,
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
