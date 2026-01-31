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

const normalizePath = (p: string) =>
  p.replace(/\\/g, "/").replace(/^\.?\//, "");

const byPath = (files: ProjectFile[]) => {
  const map = new Map<string, ProjectFile>();
  for (const f of files) map.set(normalizePath(f.path), f);
  return map;
};

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

// --- helpers for warn autofix

function ensureEndsWithNewline(s: string): string {
  return s.endsWith("\n") ? s : s + "\n";
}

function normalizeGitignoreEntry(entry: string): string {
  const e = String(entry ?? "").trim();
  if (!e) return "";
  // keep as-is except ensure folders end with "/"
  if (e.endsWith("/") || e.includes("*") || e.includes("!")) return e;
  // for typical folder patterns like node_modules or .expo, prefer trailing slash
  if (!e.includes(".") || e.startsWith("."))
    return e.endsWith("/") ? e : `${e}/`;
  return e;
}

function gitignoreAppendMissing(existing: string, misses: string[]): string {
  const lines = (existing ?? "").split(/\r?\n/);

  const normalizedExisting = new Set(
    lines
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"))
      .flatMap((l) => {
        const a = l;
        const b = l.endsWith("/") ? l.slice(0, -1) : `${l}/`;
        return [a, b];
      }),
  );

  const out = [...lines];
  let changed = false;

  for (const raw of misses) {
    const norm = normalizeGitignoreEntry(raw);
    if (!norm) continue;

    const a = norm;
    const b = norm.endsWith("/") ? norm.slice(0, -1) : `${norm}/`;

    if (normalizedExisting.has(a) || normalizedExisting.has(b)) continue;

    out.push(a);
    normalizedExisting.add(a);
    normalizedExisting.add(b);
    changed = true;
  }

  const joined = out.join("\n");
  return changed
    ? ensureEndsWithNewline(joined)
    : ensureEndsWithNewline(existing ?? "");
}

function npmrcLockfileSetting(content: string): boolean | null {
  // returns:
  //   true  -> package-lock=true/1
  //   false -> package-lock=false/0
  //   null  -> not set
  const c = String(content ?? "");
  const re = /(^|\n)\s*package-lock\s*=\s*(true|false|1|0)\s*(\n|$)/im;
  const m = c.match(re);
  if (!m) return null;
  const v = String(m[2]).toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return null;
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

    const stub =
      "import { registerRootComponent } from 'expo';\n" +
      "import App from './App';\n\n" +
      "registerRootComponent(App);\n";

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
        cli: { appVersionSource: "remote" },
        build: {
          development: { developmentClient: true, distribution: "internal" },
          preview: { distribution: "internal", android: { buildType: "apk" } },
          production: { android: { buildType: "apk" } },
        },
      };
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: statusBySeverity(this.severity),
        message: "eas.json fehlt. Ohne Profile können Builds schief laufen.",
        fix: {
          patch: mkFix([
            {
              path: "eas.json",
              content: JSON.stringify(template, null, 2) + "\n",
            },
          ]),
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

    const buildType = p?.android?.buildType;

    // APK-only policy: for this app, ALL profiles must build installable APKs.
    // Make it explicit; missing buildType is allowed but should be fixed.
    if (!buildType) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message: `${profile}.android.buildType ist nicht gesetzt – bitte explizit "apk" setzen.`,
        fix: {
          label: `Setze ${profile}.android.buildType auf "apk"`,
          patch: {
            jsonMerge: [
              {
                path: "eas.json",
                patch: { build: { [profile]: { android: { buildType: "apk" } } } },
                createIfMissing: true,
              },
            ],
            explanation:
              "Der In-App APK Builder unterstützt ausschließlich APK (kein AAB).",
          },
        },
      };
    }

    if (buildType !== "apk") {
      return {
        id: this.id,
        title: this.title,
        severity: "high",
        status: "fail",
        message: `${profile}.android.buildType ist "${buildType}" – diese App unterstützt ausschließlich "apk".`,
        fix: {
          label: `Setze ${profile}.android.buildType auf "apk"`,
          patch: {
            jsonMerge: [
              {
                path: "eas.json",
                patch: { build: { [profile]: { android: { buildType: "apk" } } } },
                createIfMissing: true,
              },
            ],
            explanation:
              "Der In-App APK Builder unterstützt ausschließlich APK (kein AAB).",
          },
        },
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

// --- Extra quality checks ---

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
      const npmrc = has(m, ".npmrc") ? getText(m, ".npmrc") : "";
      const setting = npmrc ? npmrcLockfileSetting(npmrc) : null;

      if (setting === true) {
        return ok({
          id: this.id,
          title: this.title,
          severity: this.severity,
          status: "pass",
          message:
            "Kein Lockfile im Source – wird beim Install generiert (.npmrc: package-lock=true).",
        });
      }

      if (setting === false) {
        return {
          id: this.id,
          title: this.title,
          severity: this.severity,
          status: "warn",
          message:
            "Kein Lockfile im Source und .npmrc deaktiviert package-lock (package-lock=false). Builds können dadurch inkonsistent werden.",
          fix: {
            patch: mkFix(
              [
                {
                  path: ".npmrc",
                  content: ensureEndsWithNewline(
                    (npmrc || "").replace(
                      /(^|\n)\s*package-lock\s*=\s*(false|0)\s*(\n|$)/im,
                      "$1package-lock=true$3",
                    ) ||
                      "# Generated by k1w1 diagnostics\npackage-lock=true\nsave-exact=true\n",
                  ),
                },
              ],
              [],
              ".npmrc korrigieren (package-lock=true)",
            ),
          },
        };
      }

      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message:
          "Kein Lockfile gefunden (package-lock.json / yarn.lock / pnpm-lock.yaml). Builds können dadurch inkonsistent werden.",
        fix: {
          patch: mkFix(
            [
              {
                path: ".npmrc",
                content: ensureEndsWithNewline(
                  "# Generated by k1w1 diagnostics\npackage-lock=true\nsave-exact=true\n",
                ),
              },
            ],
            [],
            ".npmrc anlegen (Lockfile beim Install erzwingen)",
          ),
        },
      };
    }

    if (lockCount > 1) {
      const details = [
        hasNpm ? "package-lock.json" : null,
        hasYarn ? "yarn.lock" : null,
        hasPnpm ? "pnpm-lock.yaml" : null,
      ].filter(Boolean) as string[];

      // default preference: pnpm > npm > yarn
      const keep = hasPnpm
        ? "pnpm-lock.yaml"
        : hasNpm
          ? "package-lock.json"
          : "yarn.lock";

      const del: string[] = [];
      if (keep !== "package-lock.json" && hasNpm) del.push("package-lock.json");
      if (keep !== "yarn.lock" && hasYarn) del.push("yarn.lock");
      if (keep !== "pnpm-lock.yaml" && hasPnpm) del.push("pnpm-lock.yaml");

      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message: `Mehrere Lockfiles gefunden (${details.length}). Nutze nur EINEN Package Manager.`,
        details,
        fix: del.length
          ? {
              patch: mkFix(
                [],
                del,
                `Zusätzliche Lockfiles entfernen (behalte: ${keep})`,
              ),
            }
          : undefined,
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

      // keep this list small + relevant for exported projects
      const misses: string[] = [];
      const mustHave = [
        "node_modules/",
        ".expo/",
        ".expo-shared/",
        ".vscode/",
        ".idea/",
        ".env",
        "dist/",
        "build/",
        "web-build/",
        "*.log",
      ];

      const lowered = content.toLowerCase();
      for (const entry of mustHave) {
        const e = entry.toLowerCase().replace(/\/$/, "");
        // naive but stable: substring check (works for typical ignore lines)
        if (!lowered.includes(e)) misses.push(entry);
      }

      if (misses.length) {
        const next = gitignoreAppendMissing(content, misses);
        return {
          id: this.id,
          title: this.title,
          severity: this.severity,
          status: "warn",
          message: ".gitignore wirkt unvollständig (häufige Einträge fehlen).",
          details: misses,
          fix:
            next.trim() && next.trim() !== content.trim()
              ? {
                  patch: mkFix(
                    [{ path: ".gitignore", content: next }],
                    [],
                    "Fehlende .gitignore Einträge ergänzen",
                  ),
                }
              : undefined,
        };
      }

      return ok({ id: this.id, title: this.title, severity: this.severity });
    }

    const template = `# Dependencies
node_modules/

# Expo
.expo/
.expo-shared/
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

# IDE
.vscode/
.idea/

# Metro
.metro-health-check*

# Debug
npm-debug.*
yarn-debug.*
yarn-error.*
*.log

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

    const expoMajor = Number(String(expo).match(/(\d+)/)?.[1] ?? "0");
    const rnMajorMinor = String(rn).match(/(\d+)\.(\d+)/);
    if (expoMajor >= 54 && rnMajorMinor) {
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
// NOTE: No YAML parser here by design (lightweight). This check is conservative.

const GH_EXPR_REF_RE =
  /^\$\{\{\s*(secrets|env|vars|inputs)\.[A-Za-z0-9_]+\s*\}\}$/i;
const SHELL_ENV_REF_RE = /^\$\{?[A-Za-z_][A-Za-z0-9_]*\}?$/;

// JWT-like AND generic secret-like tokens (long, base64-ish / urlsafe-ish)
const JWT_LIKE_RE =
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/;
const GENERIC_SECRET_RE = /^[A-Za-z0-9._-]{40,}$/;

function stripInlineYamlComment(value: string): string {
  const v = value.trim();
  if (!v) return v;
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v;
  }
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

  // single-line: KEY: VALUE
  const assignRe =
    /^([\t -]*)?([A-Za-z0-9_]*SERVICE_ROLE[A-Za-z0-9_]*)\s*:\s*(.+?)\s*$/i;

  // block scalar start: KEY: | / KEY: >
  const blockStartRe =
    /^([\t -]*)?([A-Za-z0-9_]*SERVICE_ROLE[A-Za-z0-9_]*)\s*:\s*([|>])\s*$/i;

  const looksSecret = (raw: string) => {
    const v = unquoteYamlScalar(stripInlineYamlComment(raw)).trim();
    if (!v) return false;
    if (GH_EXPR_REF_RE.test(v) || SHELL_ENV_REF_RE.test(v)) return false;
    return JWT_LIKE_RE.test(v) || (GENERIC_SECRET_RE.test(v) && !/\s/.test(v));
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // block scalar case (cannot safely auto-fix multi-line content)
    const bm = raw.match(blockStartRe);
    if (bm) {
      const key = bm[2] ?? "";
      // scan subsequent indented lines until indentation drops
      const baseIndent = (bm[1] ?? "").length;
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j] ?? "";
        const indent = l.match(/^(\s*)/)?.[1]?.length ?? 0;
        if (l.trim() && indent <= baseIndent) break;
        if (looksSecret(l)) {
          leaks.push(`${key} (block, near line ${i + 1})`);
          break;
        }
      }
      continue;
    }

    const m = raw.match(assignRe);
    if (!m) continue;

    const indent = m[1] ?? "";
    const key = m[2] ?? "";
    const valueRaw = m[3] ?? "";
    if (!looksSecret(valueRaw)) continue;

    leaks.push(`${key} (line ${i + 1})`);
    // auto-fix single-line only
    outLines[i] = `${indent}${key}: \${{ secrets.${key} }}`;
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

    if (!workflowFiles.length) {
      return ok({ id: this.id, title: this.title, severity: this.severity });
    }

    const details: string[] = [];
    const fixes: Array<{ path: string; content: string }> = [];

    for (const p of workflowFiles) {
      const f = m.get(p);
      if (!f) continue;

      const scan = scanWorkflowServiceRoleUsage(f.content ?? "");
      if (!scan.leaks.length) continue;

      details.push(`${p}: ${scan.leaks.join(", ")}`);
      if (scan.fixed) fixes.push({ path: p, content: scan.fixed });
    }

    if (!details.length) {
      return ok({ id: this.id, title: this.title, severity: this.severity });
    }

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
      const content = f.content ?? "";

      // fast path: forbidden by filename/extension
      for (const pat of FORBIDDEN_PATTERNS) {
        if (pat.re.test(p)) {
          hits.push(`${p} (${pat.label})`);
          break;
        }
      }

      // huge content heuristic BEFORE scanning content (perf)
      if (content.length > 2_000_000) {
        hits.push(
          `${p} (sehr groß: ${Math.round(content.length / 1024 / 1024)}MB in content)`,
        );
        continue;
      }

      // now scan content (safe size)
      for (const pat of FORBIDDEN_PATTERNS) {
        if (pat.re.test(content)) {
          hits.push(`${p} (${pat.label})`);
          break;
        }
      }
    }

    if (!hits.length) {
      return ok({ id: this.id, title: this.title, severity: this.severity });
    }

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
