// lib/projectMaterializer.ts

import { normalizePath } from "./validators";

import type { ProjectFile, ProjectData } from "../shared/types/project";
export type MaterializeOptions = {
  name?: string;
  slug?: string;
  packageName?: string;
};

type ProjectFileLike = {
  path?: unknown;
  content?: unknown;
};

function isProjectFileLike(file: unknown): file is ProjectFileLike {
  return !!file && typeof file === "object";
}

function readProjectFileContent(file: ProjectFileLike): string {
  return typeof file.content === "string" ? file.content : String(file.content ?? "");
}

/**
 * Make project metadata (name/slug/android.package) reflect inside config files.
 * This is CRITICAL for new projects: otherwise UI state != repo files.
 */
export function materializeProjectFiles(
  files: ProjectFile[],
  opts: MaterializeOptions,
): ProjectFile[] {
  const name = (opts.name ?? "").trim();
  const slug = slugify((opts.slug ?? name) || "app");
  const packageName = sanitizeAndroidPackage(opts.packageName ?? "");

  const out: ProjectFile[] = [];
  const map = new Map<string, ProjectFile>();

  for (const f of files ?? []) {
    if (!isProjectFileLike(f)) continue;
    const p = normalizePath(String(f.path ?? ""));
    if (!p) continue;
    const c = readProjectFileContent(f);
    const pf = { path: p, content: c };
    map.set(p, pf);
  }

  // --- package.json ---
  if (map.has("package.json")) {
    const raw = map.get("package.json")!.content;
    const next = updatePackageJson(raw, slug);
    map.set("package.json", { path: "package.json", content: next });
  }

  // --- app.json ---
  if (map.has("app.json")) {
    const raw = map.get("app.json")!.content;
    const next = updateAppJson(raw, name, slug, packageName);
    map.set("app.json", { path: "app.json", content: next });
  }

  // --- app.config.js ---
  if (map.has("app.config.js")) {
    const raw = map.get("app.config.js")!.content;
    const next = updateAppConfigJs(raw, name, slug, packageName);
    map.set("app.config.js", { path: "app.config.js", content: next });
  }

  // If no app.json/app.config.js exists, create minimal app.json (Android only)
  if (!map.has("app.json") && !map.has("app.config.js")) {
    const minimal = {
      expo: {
        name: name || "My App",
        slug,
        version: "1.0.0",
        platforms: ["android"],
        newArchEnabled: true,
        android: {
          package: packageName || "com.example.app",
          adaptiveIcon: {
            foregroundImage: "./assets/adaptive-icon.png",
            backgroundColor: "#ffffff",
          },
        },
        icon: "./assets/icon.png",
        splash: {
          image: "./assets/splash.png",
          resizeMode: "contain",
          backgroundColor: "#ffffff",
        },
        assetBundlePatterns: ["**/*"],
      },
    };
    map.set("app.json", {
      path: "app.json",
      content: JSON.stringify(minimal, null, 2),
    });
  }

  // materialize to stable array order
  for (const [p, v] of [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    out.push({ path: p, content: v.content });
  }
  return out;
}

export function materializeProjectData(project: ProjectData): ProjectData {
  const nextFiles = materializeProjectFiles(project.files, {
    name: project.name,
    slug: project.slug ?? project.name,
    packageName: project.packageName,
  });
  return { ...project, slug: slugify(project.slug ?? project.name), files: nextFiles };
}

// ---------------- helpers ----------------

export function slugify(input: string): string {
  const s = String(input ?? "").trim().toLowerCase();
  const cleaned = s
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "app";
}

// Android package: com.company.app (lowercase, at least 2 segments)
export function sanitizeAndroidPackage(input: string): string {
  const raw = String(input ?? "").trim();
  const lower = raw.toLowerCase();
  const safe = lower.replace(/[^a-z0-9._]/g, "");
  const parts = safe.split(".").filter(Boolean);
  if (parts.length < 2) return "";
  // each segment must start with letter
  const fixed = parts
    .map((p) => (p.match(/^[a-z]/) ? p : `a${p}`))
    .map((p) => p.replace(/_+/g, "_"))
    .join(".");
  return fixed;
}

function updatePackageJson(raw: string, slug: string): string {
  try {
    const pkg = JSON.parse(raw);
    if (pkg && typeof pkg === "object") {
      pkg.name = slug;
      return JSON.stringify(pkg, null, 2);
    }
  } catch {
    // fallthrough
  }
  // best-effort regex
  if (!raw) return raw;
  return raw.replace(/"name"\s*:\s*"[^"]*"/, `"name": "${slug}"`);
}

function updateAppJson(raw: string, name: string, slug: string, packageName: string): string {
  try {
    const obj = JSON.parse(raw);
    const expo = obj?.expo && typeof obj.expo === "object" ? obj.expo : {};
    if (name) expo.name = name;
    expo.slug = slug;
    expo.platforms = ["android"];
    expo.newArchEnabled = true;

    expo.android = expo.android && typeof expo.android === "object" ? expo.android : {};
    if (packageName) expo.android.package = packageName;

    obj.expo = expo;
    return JSON.stringify(obj, null, 2);
  } catch {
    // best-effort regex
    let out = raw || "";
    if (name) out = out.replace(/"name"\s*:\s*"[^"]*"/, `"name": "${escapeJson(name)}"`);
    out = out.replace(/"slug"\s*:\s*"[^"]*"/, `"slug": "${slug}"`);
    if (packageName) {
      // add or replace android.package
      if (/"android"\s*:\s*{[\s\S]*?}/m.test(out)) {
        if (/"package"\s*:\s*"[^"]*"/m.test(out)) {
          out = out.replace(/"package"\s*:\s*"[^"]*"/m, `"package": "${packageName}"`);
        } else {
          out = out.replace(/"android"\s*:\s*{/, `"android": {\n      "package": "${packageName}",`);
        }
      }
    }
    return out;
  }
}

function updateAppConfigJs(raw: string, name: string, slug: string, packageName: string): string {
  let out = raw || "";

  // name/slug/package are replaced opportunistically; do not assume a specific formatting
  if (name) {
    out = out.replace(/\bname\s*:\s*['"][^'"]*['"]/, `name: '${escapeJs(name)}'`);
  }
  if (slug) {
    out = out.replace(/\bslug\s*:\s*['"][^'"]*['"]/, `slug: '${escapeJs(slug)}'`);
  }
  if (packageName) {
    out = out.replace(/\bpackage\s*:\s*['"][^'"]*['"]/, `package: '${escapeJs(packageName)}'`);
  }

  // Enforce Android-only platforms (insert if missing)
  if (/\bplatforms\s*:/.test(out)) {
    out = out.replace(/\bplatforms\s*:\s*\[[^\]]*\]/, "platforms: ['android']");
  } else {
    // Insert near top of expo config if possible
    if (/expo\s*:\s*{/.test(out)) {
      out = out.replace(/expo\s*:\s*{/, "expo: {\n    platforms: ['android'],");
    }
  }

  return out;
}

function escapeJson(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\"');
}

function escapeJs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
