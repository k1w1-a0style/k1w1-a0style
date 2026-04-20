import { normalizePath } from "./validators";

export type ChangeActor = "chat" | "diagnosisAutofix";

export type OwnershipGuardViolation = {
  path: string;
  reason: string;
};

const TEMPLATE_BASELINE_PREFIXES = [
  "templates/",
  "docs/patches/",
  "scripts/",
];

const TEMPLATE_BASELINE_FILES = new Set([
  "PROJECT_CHECKLOG.md",
  "docs/patches/PATCHLOG_ROOT.md",
]);

const MANUAL_CRITICAL_PREFIXES = [
  ".github/workflows/",
  ".github/actions/",
  "supabase/",
  "android/",
  "ios/",
];

const MANUAL_CRITICAL_FILES = new Set([
  ".npmrc",
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "eas.json",
  "eas-project.json",
  "app.json",
  "app.config.js",
  "app.config.ts",
  "metro.config.js",
  "tsconfig.json",
]);

const DIAGNOSIS_ALLOWED_PREFIXES = [
  ".github/workflows/",
  ".github/actions/",
  "assets/",
];

const DIAGNOSIS_ALLOWED_FILES = new Set([
  ".gitignore",
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "eas.json",
  "eas-project.json",
  "app.json",
  "app.config.js",
  "app.config.ts",
  "metro.config.js",
  "babel.config.js",
  "tsconfig.json",
  "index.js",
  "index.ts",
  "index.tsx",
  "App.js",
  "App.tsx",
]);

function isTemplateBaselinePath(path: string): boolean {
  return TEMPLATE_BASELINE_FILES.has(path) || TEMPLATE_BASELINE_PREFIXES.some((p) => path.startsWith(p));
}

function isManualCriticalPath(path: string): boolean {
  return MANUAL_CRITICAL_FILES.has(path) || MANUAL_CRITICAL_PREFIXES.some((p) => path.startsWith(p));
}

function isDiagnosisAllowedPath(path: string): boolean {
  return DIAGNOSIS_ALLOWED_FILES.has(path) || DIAGNOSIS_ALLOWED_PREFIXES.some((p) => path.startsWith(p));
}

export function canActorModifyPath(actor: ChangeActor, rawPath: string): { allowed: boolean; reason?: string; normalizedPath: string } {
  const path = normalizePath(rawPath);

  if (isTemplateBaselinePath(path)) {
    return {
      allowed: false,
      reason: `Pfad ist Template/Baseline-verwaltet und nur read-only im Runtime-Flow: ${path}`,
      normalizedPath: path,
    };
  }

  if (actor === "chat" && isManualCriticalPath(path)) {
    return {
      allowed: false,
      reason: `Pfad ist kritisch und darf nicht blind durch KI überschrieben werden: ${path}`,
      normalizedPath: path,
    };
  }

  if (actor === "diagnosisAutofix" && !isDiagnosisAllowedPath(path)) {
    return {
      allowed: false,
      reason: `Pfad liegt außerhalb des Diagnosis/Autofix-Zuständigkeitsbereichs: ${path}`,
      normalizedPath: path,
    };
  }

  return { allowed: true, normalizedPath: path };
}

export function findOwnershipViolations(actor: ChangeActor, paths: string[]): OwnershipGuardViolation[] {
  const violations: OwnershipGuardViolation[] = [];

  for (const p of paths) {
    const decision = canActorModifyPath(actor, p);
    if (!decision.allowed) {
      violations.push({
        path: decision.normalizedPath,
        reason: decision.reason ?? "Ownership guard violation",
      });
    }
  }

  return violations;
}
