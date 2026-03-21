import type { ProjectFile } from "../../../shared/types/project";
import type {
  DependencyImportMismatchFinding,
  PreflightCheck,
  PreflightCheckResult,
} from "../preflightTypes";
import { byPath, getText, has, ok, parseJson } from "../preflightHelpers";

const RUNTIME_SOURCE_FILE_RE = /(?:^|\/)(App|index)\.(?:[cm]?[jt]sx?)$|\.(?:[cm]?[jt]sx?)$/i;
const EXCLUDED_SOURCE_SEGMENTS = [
  "__tests__/",
  "__mocks__/",
  "android/",
  "ios/",
  "docs/",
  "coverage/",
  "dist/",
  "build/",
  "scripts/",
  ".github/",
  "supabase/",
];
const EXCLUDED_SOURCE_FILE_RE = /(?:^|\/)(?:jest|babel|metro|eslint|prettier|commitlint|vitest|webpack)\.config\.[^/]+$/i;
const EXCLUDED_TEST_FILE_RE = /(?:^|\/).+\.(?:test|spec)\.[cm]?[jt]sx?$/i;
const PACKAGE_IMPORT_RE = /(?:^|[^.\w$])(?:import\s+(?:type\s+)?(?:[^"'`]+?\s+from\s+)?|export\s+[^"'`]+?\s+from\s+|require\s*\(|import\s*\()\s*["']([^"']+)["']/gm;

const SAFE_EXPO_AUTOFIX_VERSIONS: Record<string, Record<number, string>> = {
  "expo-linear-gradient": { 54: "~15.0.8" },
  "expo-blur": { 54: "~15.0.7" },
};

type NpmLockDependencyNode = {
  version?: unknown;
  dependencies?: Record<string, NpmLockDependencyNode>;
};

type NpmLockfile = {
  packages?: Record<string, { version?: unknown }>;
  dependencies?: Record<string, NpmLockDependencyNode>;
};

function isRelevantRuntimeSourceFile(path: string): boolean {
  if (!RUNTIME_SOURCE_FILE_RE.test(path)) return false;
  if (EXCLUDED_SOURCE_SEGMENTS.some((segment) => path.includes(segment))) return false;
  if (EXCLUDED_SOURCE_FILE_RE.test(path)) return false;
  if (EXCLUDED_TEST_FILE_RE.test(path)) return false;
  if (path.endsWith(".d.ts")) return false;
  return true;
}

function isLocalImport(specifier: string): boolean {
  return (
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("~/") ||
    specifier.startsWith("@/") ||
    specifier.startsWith("#/") ||
    specifier.startsWith("file:")
  );
}

function toPackageName(specifier: string): string {
  if (specifier.startsWith("@")) {
    const [scope, name] = specifier.split("/");
    return scope && name ? `${scope}/${name}` : specifier;
  }
  return specifier.split("/")[0] ?? specifier;
}

function isTrackedRuntimePackage(packageName: string): boolean {
  return (
    packageName === "expo" ||
    packageName === "react-native" ||
    packageName.startsWith("expo-") ||
    packageName.startsWith("@expo/") ||
    packageName.startsWith("react-native-") ||
    packageName.startsWith("@react-native-")
  );
}

function collectImportedPackages(files: ProjectFile[]): Map<string, Set<string>> {
  const imported = new Map<string, Set<string>>();

  for (const file of files) {
    const path = file.path.replace(/\\/g, "/").replace(/^\.?\//, "");
    if (!isRelevantRuntimeSourceFile(path)) continue;

    const matches = file.content.matchAll(PACKAGE_IMPORT_RE);
    for (const match of matches) {
      const specifier = String(match[1] ?? "").trim();
      if (!specifier || isLocalImport(specifier)) continue;

      const packageName = toPackageName(specifier);
      if (!isTrackedRuntimePackage(packageName)) continue;

      const locations = imported.get(packageName) ?? new Set<string>();
      locations.add(path);
      imported.set(packageName, locations);
    }
  }

  return imported;
}

function detectExpoMajor(pkg: Record<string, unknown>): number | null {
  const combined = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  } as Record<string, unknown>;
  const expo = typeof combined.expo === "string" ? combined.expo : "";
  const match = expo.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function buildSuggestedInstallMethod(packageName: string): string {
  if (packageName === "expo" || packageName.startsWith("expo-") || packageName.startsWith("@expo/")) {
    return `npx expo install ${packageName}`;
  }
  return `npm install ${packageName}`;
}

function resolveSafeAutofixVersion(packageName: string, expoMajor: number | null): string | undefined {
  if (!expoMajor) return undefined;
  return SAFE_EXPO_AUTOFIX_VERSIONS[packageName]?.[expoMajor];
}

function findVersionInNpmDependencyTree(
  dependencies: Record<string, NpmLockDependencyNode> | undefined,
  packageName: string,
): string | undefined {
  if (!dependencies || typeof dependencies !== "object") return undefined;

  const direct = dependencies[packageName];
  if (direct && typeof direct.version === "string" && direct.version.trim()) {
    return direct.version.trim();
  }

  for (const value of Object.values(dependencies)) {
    const nested = findVersionInNpmDependencyTree(value?.dependencies, packageName);
    if (nested) return nested;
  }

  return undefined;
}

function resolveVersionFromNpmLockfiles(files: ProjectFile[], packageName: string): string | undefined {
  for (const lockfilePath of ["package-lock.json", "npm-shrinkwrap.json"]) {
    const file = files.find((entry) => entry.path === lockfilePath);
    if (!file?.content) continue;

    const parsed = parseJson<NpmLockfile>(file.content);
    if (!parsed || typeof parsed !== "object") continue;

    const packageEntry = parsed.packages?.[`node_modules/${packageName}`];
    if (packageEntry && typeof packageEntry.version === "string" && packageEntry.version.trim()) {
      return packageEntry.version.trim();
    }

    const nested = findVersionInNpmDependencyTree(parsed.dependencies, packageName);
    if (nested) return nested;
  }

  return undefined;
}

function resolveAutofixVersion(
  files: ProjectFile[],
  packageName: string,
  expoMajor: number | null,
): string | undefined {
  return resolveVersionFromNpmLockfiles(files, packageName) ?? resolveSafeAutofixVersion(packageName, expoMajor);
}

function buildFindingDetail(finding: DependencyImportMismatchFinding): string {
  const files = finding.importingFiles.slice(0, 3).join(", ");
  const moreCount = Math.max(0, finding.importingFiles.length - 3);
  const fileHint = moreCount > 0 ? `${files} (+${moreCount} weitere)` : files;
  const location = fileHint ? ` in ${fileHint}` : "";
  const fixHint =
    finding.fixability === "autofix"
      ? ` AutoFix kann ${finding.versionSuggestion ? `(${finding.versionSuggestion}) ` : ""}package.json ergänzen.`
      : ` Kein sicherer AutoFix: bitte ${finding.suggestedInstallMethod} ausführen und package.json/Lockfile committen.`;

  if (finding.category === "runtime_dependency_in_devDependencies") {
    return `${finding.packageName} liegt nur in devDependencies, wird aber zur Laufzeit${location} importiert.${fixHint}`;
  }

  return `${finding.packageName} fehlt in dependencies, wird aber zur Laufzeit${location} importiert.${fixHint}`;
}

function buildAutofixPatch(
  pkg: Record<string, unknown>,
  findings: DependencyImportMismatchFinding[],
): { content: string; appliedPackages: string[] } | null {
  const safeFindings = findings.filter((finding) => finding.fixability === "autofix");
  if (safeFindings.length === 0) return null;

  const nextPkg = JSON.parse(JSON.stringify(pkg || {})) as Record<string, unknown>;
  const dependencies: Record<string, unknown> =
    nextPkg.dependencies && typeof nextPkg.dependencies === "object" && !Array.isArray(nextPkg.dependencies)
      ? { ...(nextPkg.dependencies as Record<string, unknown>) }
      : {};
  const devDependencies: Record<string, unknown> =
    nextPkg.devDependencies && typeof nextPkg.devDependencies === "object" && !Array.isArray(nextPkg.devDependencies)
      ? { ...(nextPkg.devDependencies as Record<string, unknown>) }
      : {};

  const appliedPackages: string[] = [];

  for (const finding of safeFindings) {
    const version =
      finding.category === "runtime_dependency_in_devDependencies"
        ? typeof devDependencies[finding.packageName] === "string"
          ? devDependencies[finding.packageName]
          : finding.versionSuggestion
        : finding.versionSuggestion;

    if (!version) continue;

    dependencies[finding.packageName] = version;
    delete devDependencies[finding.packageName];
    appliedPackages.push(finding.packageName);
  }

  if (appliedPackages.length === 0) return null;

  nextPkg.dependencies = dependencies;
  if (Object.keys(devDependencies).length > 0) nextPkg.devDependencies = devDependencies;
  else delete nextPkg.devDependencies;

  return {
    content: `${JSON.stringify(nextPkg, null, 2)}\n`,
    appliedPackages,
  };
}

export function findRuntimeDependencyImportMismatches(
  files: ProjectFile[],
): DependencyImportMismatchFinding[] {
  const m = byPath(files);
  if (!has(m, "package.json")) return [];

  const pkg = parseJson<Record<string, unknown>>(getText(m, "package.json"));
  if (!pkg || typeof pkg !== "object") return [];

  const dependencies =
    pkg.dependencies && typeof pkg.dependencies === "object" && !Array.isArray(pkg.dependencies)
      ? (pkg.dependencies as Record<string, unknown>)
      : {};
  const devDependencies =
    pkg.devDependencies && typeof pkg.devDependencies === "object" && !Array.isArray(pkg.devDependencies)
      ? (pkg.devDependencies as Record<string, unknown>)
      : {};
  const expoMajor = detectExpoMajor(pkg);
  const imported = collectImportedPackages(files);

  const findings: DependencyImportMismatchFinding[] = [];
  for (const [packageName, importingFilesSet] of imported.entries()) {
    const importingFiles = Array.from(importingFilesSet).sort();

    if (typeof dependencies[packageName] === "string") continue;

    const inDevDependencies = typeof devDependencies[packageName] === "string";
    const versionSuggestion = resolveAutofixVersion(files, packageName, expoMajor);
    findings.push({
      packageName,
      importingFiles,
      severity: "high",
      category: inDevDependencies
        ? "runtime_dependency_in_devDependencies"
        : "missing_runtime_dependency",
      fixability: inDevDependencies || versionSuggestion ? "autofix" : "manual",
      suggestedInstallMethod: buildSuggestedInstallMethod(packageName),
      versionSuggestion: inDevDependencies
        ? String(devDependencies[packageName])
        : versionSuggestion,
    });
  }

  return findings.sort((a, b) => a.packageName.localeCompare(b.packageName));
}

export const checkRuntimeImportDependencies: PreflightCheck = {
  id: "runtime-import-dependency-mismatches",
  title: "Runtime-Imports gegen package.json prüfen",
  severity: "high",
  run(files): PreflightCheckResult {
    const m = byPath(files);
    if (!has(m, "package.json")) {
      return ok({
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "pass",
      });
    }

    const rawPackageJson = getText(m, "package.json");
    const pkg = parseJson<Record<string, unknown>>(rawPackageJson);
    if (!pkg || typeof pkg !== "object") {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "fail",
        message:
          "Runtime-Dependency-Diagnose konnte package.json nicht lesen. Bitte JSON zuerst reparieren.",
        tags: ["dependencies", "runtime-imports", "missing_runtime_dependency"],
      };
    }

    const findings = findRuntimeDependencyImportMismatches(files);
    if (findings.length === 0) {
      return ok({
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "pass",
        tags: ["dependencies", "runtime-imports"],
        findings: [],
      });
    }

    const autofix = buildAutofixPatch(pkg, findings);
    const manualOnly = findings.filter((finding) => finding.fixability !== "autofix");
    const detailLines = findings.map(buildFindingDetail);

    return {
      id: this.id,
      title: this.title,
      severity: this.severity,
      status: "fail",
      message:
        manualOnly.length === 0
          ? `Es fehlen ${findings.length} Runtime-Dependencies, die vor CI Lite auffallen würden.`
          : `Es fehlen ${findings.length} Runtime-Dependencies; ${manualOnly.length} davon brauchen eine manuelle Nacharbeit vor CI Lite.`,
      details: detailLines,
      tags: ["dependencies", "runtime-imports", "missing_runtime_dependency"],
      findings,
      fix:
        autofix && autofix.appliedPackages.length > 0
          ? {
              label:
                manualOnly.length > 0
                  ? `Sichere Dependencies ergänzen (${autofix.appliedPackages.join(", ")})`
                  : `Dependencies ergänzen (${autofix.appliedPackages.join(", ")})`,
              patch: {
                upsert: [{ path: "package.json", content: autofix.content }],
                explanation:
                  manualOnly.length > 0
                    ? `Ergänzt nur sichere Runtime-Dependencies (${autofix.appliedPackages.join(", ")}). Weitere Pakete bitte manuell via Expo/NPM installieren.`
                    : `Ergänzt sichere Runtime-Dependencies in package.json (${autofix.appliedPackages.join(", ")}).`,
              },
            }
          : undefined,
    };
  },
};
