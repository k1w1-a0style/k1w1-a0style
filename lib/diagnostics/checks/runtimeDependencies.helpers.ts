import type { ProjectFile } from "../../../shared/types/project";

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

export const SAFE_EXPO_AUTOFIX_VERSIONS: Record<string, Record<number, string>> = {
  "expo-linear-gradient": { 54: "~15.0.8" },
  "expo-blur": { 54: "~15.0.7" },
};

export function isRelevantRuntimeSourceFile(path: string): boolean {
  if (!RUNTIME_SOURCE_FILE_RE.test(path)) return false;
  if (EXCLUDED_SOURCE_SEGMENTS.some((segment) => path.includes(segment))) return false;
  if (EXCLUDED_SOURCE_FILE_RE.test(path)) return false;
  if (EXCLUDED_TEST_FILE_RE.test(path)) return false;
  if (path.endsWith(".d.ts")) return false;
  return true;
}

export function isLocalImport(specifier: string): boolean {
  return (
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("~/") ||
    specifier.startsWith("@/") ||
    specifier.startsWith("#/") ||
    specifier.startsWith("file:")
  );
}

export function toPackageName(specifier: string): string {
  if (specifier.startsWith("@")) {
    const [scope, name] = specifier.split("/");
    return scope && name ? `${scope}/${name}` : specifier;
  }
  return specifier.split("/")[0] ?? specifier;
}

export function isTrackedRuntimePackage(packageName: string): boolean {
  return (
    packageName === "expo" ||
    packageName === "react-native" ||
    packageName.startsWith("expo-") ||
    packageName.startsWith("@expo/") ||
    packageName.startsWith("react-native-") ||
    packageName.startsWith("@react-native-")
  );
}

export function collectImportedPackages(files: ProjectFile[]): Map<string, Set<string>> {
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

export function detectExpoMajor(pkg: Record<string, unknown>): number | null {
  const combined = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  } as Record<string, unknown>;
  const expo = typeof combined.expo === "string" ? combined.expo : "";
  const match = expo.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

export function buildSuggestedInstallMethod(packageName: string): string {
  if (packageName === "expo" || packageName.startsWith("expo-") || packageName.startsWith("@expo/")) {
    return `npx expo install ${packageName}`;
  }
  return `npm install ${packageName}`;
}
