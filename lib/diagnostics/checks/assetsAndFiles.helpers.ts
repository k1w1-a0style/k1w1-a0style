import type { ProjectFile } from "../../../shared/types/project";
import { byPath, has, normalizePath, parseJson } from "../preflightHelpers";

type EasWithoutCredentialsPatchProfile = Readonly<{
  android: Readonly<{
    withoutCredentials: true;
  }>;
}>;

export type EasProfileConfig = Readonly<{
  android?: Readonly<{
    withoutCredentials?: boolean;
  }>;
}>;

export type EasJson = Readonly<{
  build?: Readonly<Record<string, EasProfileConfig | undefined>>;
}>;

export const parseAssetCandidates = (cfgText: string): string[] => {
  const iconMatches = [...cfgText.matchAll(/"icon"\s*:\s*"([^"]+)"/g)]
    .map((x) => x[1])
    .filter(Boolean);

  const splashMatches = [...cfgText.matchAll(/"image"\s*:\s*"([^"]+)"/g)]
    .map((x) => x[1])
    .filter(Boolean);

  return [...new Set([...iconMatches, ...splashMatches])]
    .map((p) => normalizePath(p.replace(/^\.\//, "")))
    .filter((p) => p && !p.startsWith("http"));
};

export const REQUIRED_GITIGNORE_ENTRIES = [
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
] as const;

export const collectMissingGitignoreEntries = (content: string): string[] => {
  const misses: string[] = [];
  const lowered = content.toLowerCase();
  for (const entry of REQUIRED_GITIGNORE_ENTRIES) {
    const normalized = entry.toLowerCase().replace(/\/$/, "");
    if (!lowered.includes(normalized)) misses.push(entry);
  }
  return misses;
};

export const GITIGNORE_TEMPLATE = `# Dependencies
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

export const FORBIDDEN_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "Private Keys", re: /BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY/ },
  { label: "Android Keystore", re: /\.jks$|\.keystore$/i },
];

export const collectForbiddenFileHits = (
  files: ProjectFile[],
  patterns: Array<{ label: string; re: RegExp }> = FORBIDDEN_PATTERNS,
): string[] => {
  const hits = new Set<string>();

  for (const f of files) {
    const path = normalizePath(f.path);
    const content = f.content ?? "";

    let matchedByName = false;
    for (const pattern of patterns) {
      if (pattern.re.test(path)) {
        hits.add(`${path} (${pattern.label})`);
        matchedByName = true;
        break;
      }
    }

    if (content.length > 2_000_000) {
      hits.add(`${path} (sehr groß: ${Math.round(content.length / 1024 / 1024)}MB in content)`);
      continue;
    }

    if (matchedByName) continue;

    for (const pattern of patterns) {
      if (pattern.re.test(content)) {
        hits.add(`${path} (${pattern.label})`);
        break;
      }
    }
  }

  return Array.from(hits);
};

export const readNativeDirState = (files: ProjectFile[]) => {
  const byFilePath = byPath(files);
  const hasAndroidDir = files.some((f) => {
    const path = normalizePath(f.path);
    return path === "android" || path.startsWith("android/");
  });
  const hasIosDir = files.some((f) => {
    const path = normalizePath(f.path);
    return path === "ios" || path.startsWith("ios/");
  });

  const androidLooksIncomplete =
    hasAndroidDir && !(has(byFilePath, "android/app/build.gradle") || has(byFilePath, "android/app/build.gradle.kts"));

  const iosLooksIncomplete = hasIosDir && !has(byFilePath, "ios/Podfile");

  return {
    androidLooksIncomplete,
    iosLooksIncomplete,
  };
};

export const readWithoutCredentialsEnabled = (eas: EasJson, profileName: string): boolean => {
  const build = eas.build ?? {};
  const profile = build[profileName];
  if (!profile) return false;
  return profile.android?.withoutCredentials === true;
};

export const parseEasJson = (raw: string): EasJson | null => {
  return parseJson<EasJson>(raw);
};

export const buildWithoutCredentialsPatch = (params: { devOk: boolean; previewOk: boolean }): Partial<
  Record<"development" | "preview", EasWithoutCredentialsPatchProfile>
> => {
  const patchObj: Partial<Record<"development" | "preview", EasWithoutCredentialsPatchProfile>> = {};
  if (!params.devOk) patchObj.development = { android: { withoutCredentials: true } };
  if (!params.previewOk) patchObj.preview = { android: { withoutCredentials: true } };
  return patchObj;
};
