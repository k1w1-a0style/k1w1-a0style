// lib/diagnostics/preflightChecks.ts
// REFACTORED: Checks split into category modules under ./checks/
// Helpers extracted to ./preflightHelpers.ts

import type { ProjectFile } from "../../shared/types/project";
import type { PreflightCheck } from "./preflightTypes";
import { safeTruncate, sanitizeJsonString, sanitizeText } from "./sanitize";
import { normalizePath, byPath } from "./preflightHelpers";

// --- Check imports (by category) ---
import { checkPackageJson, checkEntryPoint } from "./checks/packageAndEntry";
import { checkEasProfiles, checkExpoConfig, checkSdkConsistency } from "./checks/configAndProfiles";
import {
  checkAssetsExist,
  checkLockfileConsistency,
  checkGitignorePresent,
  checkForbiddenFiles,
  checkNativeDirsManagedGuard,
  checkEasWithoutCredentialsForDebug,
} from "./checks/assetsAndFiles";
import { checkReactNativeCompatibility, checkQualityScriptsDeps } from "./checks/qualityAndCompat";
import { checkWorkflowServiceRoleKeyLeak, checkWorkflowYamlNameColonQuoting } from "./checks/workflowSecurity";

// Re-export individual checks for direct imports elsewhere
export {
  checkPackageJson, checkEntryPoint,
  checkEasProfiles, checkExpoConfig, checkSdkConsistency,
  checkAssetsExist, checkLockfileConsistency, checkGitignorePresent,
  checkForbiddenFiles, checkNativeDirsManagedGuard, checkEasWithoutCredentialsForDebug,
  checkReactNativeCompatibility, checkQualityScriptsDeps,
  checkWorkflowServiceRoleKeyLeak, checkWorkflowYamlNameColonQuoting,
};

export const PREFLIGHT_CHECKS: PreflightCheck[] = [
  checkPackageJson,
  checkGitignorePresent,
  checkLockfileConsistency,
  checkEntryPoint,
  checkExpoConfig,
  checkAssetsExist,
  checkNativeDirsManagedGuard,
  checkEasWithoutCredentialsForDebug,
  checkQualityScriptsDeps,
  checkEasProfiles,
  checkSdkConsistency,
  checkReactNativeCompatibility,
  checkWorkflowServiceRoleKeyLeak,
  checkWorkflowYamlNameColonQuoting,
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
